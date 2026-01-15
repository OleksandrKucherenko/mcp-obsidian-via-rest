#!/bin/bash

API_PORT=${1:-27124}

WIN_HOST_IP=$(ip route | grep default | awk '{print $3}')

echo "Verify API access from docker container to host"

docker run --name verify-api-access --rm --add-host="host.docker.internal:${WIN_HOST_IP}" alpine sh -c "
  apk add --no-cache curl >/dev/null &&
  echo '[By IP: ${WIN_HOST_IP}]' &&
  curl --insecure -s -w '\nHTTP %{http_code}\n' https://$WIN_HOST_IP:$API_PORT &&
  echo '[By host.docker.internal]' &&
  curl --insecure -s -w '\nHTTP %{http_code}\n' https://host.docker.internal:$API_PORT
"
