FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html styles.css script.js /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
RUN chmod 644 /etc/nginx/conf.d/default.conf /usr/share/nginx/html/index.html /usr/share/nginx/html/styles.css /usr/share/nginx/html/script.js /usr/share/nginx/html/assets/*

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
