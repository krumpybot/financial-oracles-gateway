#!/bin/bash
# Install Financial Oracles as systemd services

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SYSTEMD_DIR="$SCRIPT_DIR/../systemd"
LOG_DIR="/var/log/financial-oracles"

echo "=== Installing Financial Oracles Services ==="

# Create log directory
mkdir -p "$LOG_DIR"
chmod 755 "$LOG_DIR"

# Copy service files
echo "Copying service files..."
cp "$SYSTEMD_DIR"/*.service /etc/systemd/system/
cp "$SYSTEMD_DIR"/*.target /etc/systemd/system/

# Reload systemd
echo "Reloading systemd..."
systemctl daemon-reload

# Enable services
echo "Enabling services..."
systemctl enable financial-oracles.target
systemctl enable perp-dex.service
systemctl enable sec-oracle.service
systemctl enable sanctions-oracle.service
systemctl enable gateway.service

# Start the stack
echo "Starting services..."
systemctl start financial-oracles.target

# Check status
echo ""
echo "=== Service Status ==="
systemctl status perp-dex.service --no-pager || true
systemctl status sec-oracle.service --no-pager || true
systemctl status sanctions-oracle.service --no-pager || true
systemctl status gateway.service --no-pager || true

echo ""
echo "=== Done ==="
echo "Logs: $LOG_DIR"
echo "Commands:"
echo "  systemctl status financial-oracles.target"
echo "  systemctl restart financial-oracles.target"
echo "  journalctl -u gateway.service -f"
