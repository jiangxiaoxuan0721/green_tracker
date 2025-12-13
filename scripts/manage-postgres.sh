#!/bin/bash

# PostgreSQL管理脚本
# 用于启动、停止和重启PostgreSQL服务

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 函数：显示帮助信息
show_help() {
    echo "用法: $0 [start|stop|restart|status|setup]"
    echo "  start   - 启动PostgreSQL服务"
    echo "  stop    - 停止PostgreSQL服务"
    echo "  restart - 重启PostgreSQL服务"
    echo "  status  - 查看PostgreSQL服务状态"
    echo "  setup   - 设置数据库和用户（仅首次使用）"
}

# 函数：启动PostgreSQL
start_postgres() {
    echo -e "${GREEN}正在启动PostgreSQL服务...${NC}"
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    echo -e "${GREEN}PostgreSQL服务已启动并设置为开机自启${NC}"
}

# 函数：停止PostgreSQL
stop_postgres() {
    echo -e "${RED}正在停止PostgreSQL服务...${NC}"
    sudo systemctl stop postgresql
    echo -e "${RED}PostgreSQL服务已停止${NC}"
}

# 函数：重启PostgreSQL
restart_postgres() {
    echo -e "${GREEN}正在重启PostgreSQL服务...${NC}"
    sudo systemctl restart postgresql
    echo -e "${GREEN}PostgreSQL服务已重启${NC}"
}

# 函数：查看PostgreSQL状态
status_postgres() {
    echo "PostgreSQL服务状态："
    sudo systemctl status postgresql --no-pager
}

# 函数：设置数据库和用户
setup_postgres() {
    echo -e "${GREEN}正在设置PostgreSQL数据库和用户...${NC}"
    
    # 读取.env文件中的配置
    if [ -f ".env" ]; then
        source .env
        DB_USER=${DB_USER:-"your_db_username"}
        DB_PASSWORD=${DB_PASSWORD:-"your_db_password"}
        DB_NAME=${DB_NAME:-"green_tracker"}
    else
        echo "错误：未找到.env文件，请先创建.env文件并配置数据库参数"
        echo "参考.env.example文件创建.env文件"
        exit 1
    fi
    
    echo "创建用户 '$DB_USER' 和数据库 '$DB_NAME'..."
    
    # 切换到postgres用户并执行SQL命令
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" || echo "用户可能已存在"
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" || echo "数据库可能已存在"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    
    echo -e "${GREEN}PostgreSQL设置完成！${NC}"
}

# 主逻辑
case "$1" in
    start)
        start_postgres
        ;;
    stop)
        stop_postgres
        ;;
    restart)
        restart_postgres
        ;;
    status)
        status_postgres
        ;;
    setup)
        setup_postgres
        ;;
    *)
        show_help
        exit 1
        ;;
esac
