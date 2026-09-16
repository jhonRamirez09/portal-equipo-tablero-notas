#!/bin/bash
set -e

echo "=== Desplegando Portal de Equipo en AWS ==="
echo ""
echo "Este script construye la Lambda y despliega toda la arquitectura"
echo "(EC2, RDS, S3, CloudFront, Lambda) usando AWS SAM."
echo ""
echo "Requisitos previos:"
echo "  1. Tener AWS CLI configurado (aws configure)"
echo "  2. Haber subido la imagen Docker de la API a Amazon ECR"
echo "  3. Tener un par de llaves EC2 creado (o dejar KeyPairName vacio)"
echo ""

read -p "URI de la imagen en ECR (ej: 123456789.dkr.ecr.us-east-1.amazonaws.com/portal-api:latest): " ECR_URI
read -p "Nombre del par de llaves EC2 (Enter para omitir): " KEY_NAME
read -sp "Contrasena para la base de datos (minimo 8 caracteres): " DB_PASS
echo ""
read -p "Cadena de conexion para la Lambda (postgresql://usuario:clave@endpoint:5432/portal_db): " DB_URL

sam build

sam deploy \
  --guided \
  --parameter-overrides \
    EcrImageUri="$ECR_URI" \
    KeyPairName="$KEY_NAME" \
    DBPassword="$DB_PASS" \
    DatabaseUrl="$DB_URL"

echo ""
echo "=== Despliegue completado ==="
echo "Revisa la salida (Outputs) de arriba para obtener las URLs y direcciones."
echo "No olvides subir los archivos de web/dist al bucket de S3 indicado en FrontendBucketName:"
echo "  aws s3 sync web/dist s3://<nombre-del-bucket>"