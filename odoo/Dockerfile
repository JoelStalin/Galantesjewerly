FROM odoo:19

USER root

# Install additional dependencies for jewelry custom addon
RUN apt-get update && apt-get install -y \
    python3-pip \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy odoo config
COPY config/odoo.conf /etc/odoo/odoo.conf

# Copy initial modules list
COPY initial_modules.txt /etc/odoo/initial_modules.txt

# Copy custom entrypoint script
COPY entrypoint.sh /custom-entrypoint.sh
RUN sed -i 's/\r$//' /custom-entrypoint.sh && chmod +x /custom-entrypoint.sh

# Create logs directory
RUN mkdir -p /var/log/odoo && chown odoo:odoo /var/log/odoo

# Copy custom addons
COPY --chown=odoo:odoo addons /mnt/extra-addons

# Non-secret runtime defaults. Real credentials must come from the container
# environment (docker compose / VM env files), never from the image itself.
ENV HOST=postgres
ENV USER=odoo
ENV ODOO_DB=galantes_db

USER odoo

ENTRYPOINT ["/custom-entrypoint.sh"]
CMD []
