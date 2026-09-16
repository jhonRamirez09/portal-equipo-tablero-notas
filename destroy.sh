#!/bin/bash
set -e

echo "=== Retirando todos los recursos de AWS ==="
echo ""
echo "Esto va a BORRAR permanentemente: la Lambda, la base de datos RDS,"
echo "la instancia EC2, el bucket S3 y la distribucion de CloudFront."
echo ""
read -p "El nombre del stack que usaste al desplegar (por defecto: portal-equipo): " STACK_NAME
STACK_NAME=${STACK_NAME:-portal-equipo}

read -p "Estas seguro? Escribe 'si' para confirmar: " CONFIRMACION

if [ "$CONFIRMACION" != "si" ]; then
  echo "Operacion cancelada."
  exit 0
fi

# El bucket de S3 debe vaciarse antes de poder borrar el stack
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text)

if [ -n "$BUCKET_NAME" ]; then
  echo "Vaciando el bucket $BUCKET_NAME..."
  aws s3 rm "s3://$BUCKET_NAME" --recursive
fi

sam delete --stack-name "$STACK_NAME" --no-prompts

echo "=== Recursos retirados ==="