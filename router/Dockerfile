# Use the official NGINX Alpine image
FROM nginx:alpine

# Install envsubst (from gettext) and optional tools
RUN apk update && apk add --no-cache gettext bash curl

# Copy your Nginx template into the image
COPY router.conf /nginx.conf.template

# Optional: expose the port your Nginx listens on
# Change to 8080 only if your template listens on 8080
EXPOSE 80

# Generate nginx.conf from template using environment variables
# and start Nginx in the foreground
CMD ["/bin/sh", "-c", "envsubst '${FRONTEND_URL} ${BACKEND_URL}' < /nginx.conf.template > /etc/nginx/nginx.conf && exec nginx -g 'daemon off;'"]
~                                                                                                                                                     