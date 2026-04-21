#!/bin/bash
set -e

DOMAIN=$1
REPO="https://github.com/AdatScienceLLC/scon-cloude.git"
APP_DIR="/var/www/scon"

echo "=== Installing system dependencies ==="
apt-get update -y
apt-get install -y python3 python3-pip python3-venv nodejs npm nginx certbot python3-certbot-nginx git

echo "=== Cloning repository ==="
rm -rf $APP_DIR
git clone $REPO $APP_DIR

echo "=== Building React frontend ==="
cd $APP_DIR/files/frontend
npm install
npm run build
cp -r dist ../frontend_dist

echo "=== Setting up Python environment ==="
cd $APP_DIR/files
python3 -m venv venv
venv/bin/pip install --upgrade pip
venv/bin/pip install -r requirements.txt

echo "=== Writing .env file ==="
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
cat > $APP_DIR/files/.env <<EOF
SECRET_KEY=$SECRET_KEY
DEBUG=False
ALLOWED_HOSTS=$DOMAIN,www.$DOMAIN
EOF

echo "=== Collecting static files ==="
cd $APP_DIR/files
mkdir -p staticfiles media
# Copy React build into Django static serving
cp -r frontend/dist/* staticfiles/
venv/bin/python manage.py collectstatic --noinput

echo "=== Setting up gunicorn logs ==="
mkdir -p /var/log/gunicorn
chown www-data:www-data /var/log/gunicorn

echo "=== Installing gunicorn systemd service ==="
cp $APP_DIR/gunicorn.service /etc/systemd/system/scon.service
sed -i "s|/var/www/scon/venv|$APP_DIR/files/venv|g" /etc/systemd/system/scon.service
sed -i "s|WorkingDirectory=/var/www/scon|WorkingDirectory=$APP_DIR/files|g" /etc/systemd/system/scon.service
sed -i "s|EnvironmentFile=/var/www/scon/.env|EnvironmentFile=$APP_DIR/files/.env|g" /etc/systemd/system/scon.service
chown -R www-data:www-data $APP_DIR
systemctl daemon-reload
systemctl enable scon
systemctl restart scon

echo "=== Configuring nginx ==="
cp $APP_DIR/nginx.conf /etc/nginx/sites-available/scon
sed -i "s|DOMAIN_PLACEHOLDER|$DOMAIN www.$DOMAIN|g" /etc/nginx/sites-available/scon
sed -i "s|/var/www/scon/staticfiles/|$APP_DIR/files/staticfiles/|g" /etc/nginx/sites-available/scon
sed -i "s|/var/www/scon/media/|$APP_DIR/files/media/|g" /etc/nginx/sites-available/scon
ln -sf /etc/nginx/sites-available/scon /etc/nginx/sites-enabled/scon
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo "=== Setting up SSL with Let's Encrypt ==="
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN

echo ""
echo "=== Deployment complete! ==="
echo "Your app is live at https://$DOMAIN"
