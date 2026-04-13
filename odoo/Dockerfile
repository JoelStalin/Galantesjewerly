FROM odoo:19

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
RUN chmod +x /custom-entrypoint.sh

# Create logs directory
RUN mkdir -p /var/log/odoo && chown odoo:odoo /var/log/odoo

ENTRYPOINT ["/custom-entrypoint.sh"]
CMD []
