#!/bin/bash
# Скрипт для обновления самоподписанного SSL сертификата

SSL_DIR="/etc/nginx/ssl"
DOMAIN="shebo.h512.ru"
DAYS_BEFORE_RENEWAL=30  # Обновлять за 30 дней до истечения

# Проверяем срок действия сертификата
if [ -f "$SSL_DIR/$DOMAIN.crt" ]; then
    EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$SSL_DIR/$DOMAIN.crt" | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))
    
    if [ $DAYS_UNTIL_EXPIRY -lt $DAYS_BEFORE_RENEWAL ]; then
        echo "Certificate expires in $DAYS_UNTIL_EXPIRY days. Renewing..."
        
        # Создаем новый сертификат
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$SSL_DIR/$DOMAIN.key" \
            -out "$SSL_DIR/$DOMAIN.crt" \
            -subj "/C=RU/ST=Moscow/L=Moscow/O=Organization/CN=$DOMAIN"
        
        # Устанавливаем правильные права
        chmod 600 "$SSL_DIR/$DOMAIN.key"
        chmod 644 "$SSL_DIR/$DOMAIN.crt"
        
        # Перезагружаем nginx
        nginx -t && systemctl reload nginx
        
        echo "Certificate renewed successfully"
    else
        echo "Certificate is valid for $DAYS_UNTIL_EXPIRY more days. No renewal needed."
    fi
else
    echo "Certificate not found. Creating new one..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/$DOMAIN.key" \
        -out "$SSL_DIR/$DOMAIN.crt" \
        -subj "/C=RU/ST=Moscow/L=Moscow/O=Organization/CN=$DOMAIN"
    
    chmod 600 "$SSL_DIR/$DOMAIN.key"
    chmod 644 "$SSL_DIR/$DOMAIN.crt"
    
    nginx -t && systemctl reload nginx
    echo "Certificate created successfully"
fi

