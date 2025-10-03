FROM selenium/standalone-chrome

USER root

EXPOSE 7900 9222 8080 4444

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        gnupg \
        build-essential \
        jq \
        dos2unix \
        ffmpeg \
        pulseaudio \
        x11vnc \
        pavucontrol \
        alsa-utils \
        sox \
        libsox-fmt-all \
        scrot \
        x11-utils \
        x11-xserver-utils \
        dbus-x11 \
        xserver-xephyr \
        xvfb \
        libxrender1 \
        libxext6 \
        libsm6 \
        redis-tools \
        wmctrl \
        debian-keyring \
        debian-archive-keyring \
        apt-transport-https && \
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg && \
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list && \
    apt-get update && \
    apt-get install -y caddy && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY monitor_chrome.sh /usr/bin/monitor_chrome.sh
COPY Caddyfile /etc/caddy/Caddyfile

RUN dos2unix /usr/bin/monitor_chrome.sh && \
    chmod 755 /usr/bin/monitor_chrome.sh

USER seluser

CMD ["bash", "-c", "/usr/bin/monitor_chrome.sh & caddy run --config /etc/caddy/Caddyfile & exec /opt/bin/entry_point.sh"]