#!/bin/bash

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout certs/nginx.key -out certs/nginx.crt -subj "/C=IT/ST=Tuscany/L=Pisa/O=Local development/CN=localhost"