#!/bin/bash
# Gateway Supervisor Script
# Ensures the gateway stays running independently of systemd

PIDFILE="/var/run/financial-oracles-gateway.pid"
LOGFILE="/var/log/financial-oracles/gateway.log"
WORKDIR="/root/clawd/agents/financial-oracles-gateway"

start_gateway() {
    if is_running; then
        echo "Gateway already running (PID: $(cat $PIDFILE))"
        return 0
    fi
    
    echo "Starting gateway..."
    cd "$WORKDIR"
    nohup /root/.bun/bin/bun run src/index.ts >> "$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    sleep 2
    
    if is_running; then
        echo "Gateway started (PID: $(cat $PIDFILE))"
        return 0
    else
        echo "Failed to start gateway"
        return 1
    fi
}

stop_gateway() {
    if ! is_running; then
        echo "Gateway not running"
        rm -f "$PIDFILE"
        return 0
    fi
    
    echo "Stopping gateway (PID: $(cat $PIDFILE))..."
    kill $(cat "$PIDFILE") 2>/dev/null
    sleep 2
    
    if is_running; then
        echo "Force killing..."
        kill -9 $(cat "$PIDFILE") 2>/dev/null
    fi
    
    rm -f "$PIDFILE"
    echo "Gateway stopped"
}

is_running() {
    if [ -f "$PIDFILE" ]; then
        if ps -p $(cat "$PIDFILE") > /dev/null 2>&1; then
            return 0
        fi
    fi
    
    # Also check by port
    if lsof -i :3000 -sTCP:LISTEN > /dev/null 2>&1; then
        # Update PID file
        PID=$(lsof -t -i :3000 -sTCP:LISTEN 2>/dev/null | head -1)
        if [ -n "$PID" ]; then
            echo $PID > "$PIDFILE"
            return 0
        fi
    fi
    
    return 1
}

check_health() {
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null)
    if [ "$RESPONSE" = "200" ]; then
        return 0
    fi
    return 1
}

status_gateway() {
    if is_running; then
        echo "Gateway is running (PID: $(cat $PIDFILE 2>/dev/null || echo 'unknown'))"
        if check_health; then
            echo "Health: OK"
        else
            echo "Health: DEGRADED (not responding)"
        fi
    else
        echo "Gateway is not running"
    fi
}

ensure_running() {
    # Called by cron - silently ensures gateway is running and healthy
    if ! is_running || ! check_health; then
        echo "[$(date -Iseconds)] Gateway down, restarting..." >> "$LOGFILE"
        stop_gateway > /dev/null 2>&1
        start_gateway > /dev/null 2>&1
    fi
}

case "$1" in
    start)
        start_gateway
        ;;
    stop)
        stop_gateway
        ;;
    restart)
        stop_gateway
        start_gateway
        ;;
    status)
        status_gateway
        ;;
    ensure)
        ensure_running
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|ensure}"
        exit 1
        ;;
esac
