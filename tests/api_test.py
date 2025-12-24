#!/usr/bin/env python3
"""
API测试脚本：注册用户并测试各种功能
"""

import sys
import os
import requests
import json
import time

# 添加项目根目录到路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

API_BASE_URL = "http://localhost:6130"

def register_user():
    """注册新用户"""
    print("注册新用户...")
    
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    
    response = requests.post(f"{API_BASE_URL}/api/auth/register", json=user_data)
    
    if response.status_code == 200:
        print("✓ 用户注册成功")
        print(f"  用户名: {user_data['username']}")
        print(f"  邮箱: {user_data['email']}")
        return True
    elif response.status_code == 400 and "用户名已存在" in response.text:
        print("ℹ 用户已存在，使用现有账户继续测试")
        return True
    else:
        print(f"✗ 用户注册失败: {response.status_code}")
        if response.status_code == 400:
            print(f"  错误信息: {response.text}")
        return False

def login_user():
    """用户登录并获取token"""
    print("\n用户登录...")
    
    login_data = {
        "username": "testuser",
        "password": "password123"
    }
    
    response = requests.post(f"{API_BASE_URL}/api/auth/login", json=login_data)
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("token")  # 根据UserResponse schema，token字段名为token
        user_id = data.get("user_id")  # 获取用户ID
        print("✓ 用户登录成功")
        return token, user_id  # 返回token和user_id
    else:
        print(f"✗ 用户登录失败: {response.status_code}")
        print(f"  错误信息: {response.text}")
        return None, None

def create_field(token):
    """创建测试地块"""
    print("\n创建测试地块...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    field_data = {
        "name": "API测试地块",
        "description": "用于API测试的地块",
        "location_wkt": "POLYGON((120.154 30.273, 120.156 30.273, 120.156 30.275, 120.154 30.275, 120.154 30.273))",
        "area_m2": 10000.0,
        "crop_type": "小麦",
        "soil_type": "壤土",
        "irrigation_type": "滴灌"
    }
    
    response = requests.post(f"{API_BASE_URL}/api/fields/", json=field_data, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        field_id = data.get("id")
        print(f"✓ 创建地块成功，ID: {field_id}")
        return field_id
    else:
        print(f"✗ 创建地块失败: {response.status_code}")
        print(f"  错误信息: {response.text}")
        return None

def create_device(token):
    """创建测试设备"""
    print("\n创建测试设备...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    device_data = {
        "device_type": "sensor",
        "platform_level": "ground",
        "model": "温湿度传感器",
        "manufacturer": "测试厂商",
        "description": "用于API测试的传感器设备"
    }
    
    response = requests.post(f"{API_BASE_URL}/api/devices/", json=device_data, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        device_id = data.get("id")
        print(f"✓ 创建设备成功，ID: {device_id}")
        return device_id
    else:
        print(f"✗ 创建设备失败: {response.status_code}")
        print(f"  错误信息: {response.text}")
        return None

def create_session(token, field_id):
    """创建测试采集会话"""
    print("\n创建测试采集会话...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    session_data = {
        "field_id": field_id,
        "mission_type": "巡检",
        "mission_name": "API测试任务",
        "description": "用于API测试的采集任务",
        "start_time": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()),
        "status": "planned"
    }
    
    response = requests.post(f"{API_BASE_URL}/api/collection-sessions/", json=session_data, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        session_id = data.get("id")
        print(f"✓ 创建采集会话成功，ID: {session_id}")
        return session_id
    else:
        print(f"✗ 创建采集会话失败: {response.status_code}")
        print(f"  错误信息: {response.text}")
        return None

def get_sessions(token):
    """获取采集会话列表"""
    print("\n获取采集会话列表...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(f"{API_BASE_URL}/api/collection-sessions/", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ 获取会话列表成功，共 {len(data)} 个会话")
        for session in data:
            print(f"  - {session.get('mission_name', '未命名')} (状态: {session.get('status', '未知')})")
        return data
    else:
        print(f"✗ 获取会话列表失败: {response.status_code}")
        print(f"  错误信息: {response.text}")
        return []

def update_session_status(token, session_id, new_status):
    """更新采集会话状态"""
    print(f"\n更新采集会话状态为 {new_status}...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    update_data = {
        "status": new_status,
        "end_time": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) if new_status == "completed" else None
    }
    
    response = requests.put(f"{API_BASE_URL}/api/collection-sessions/{session_id}", json=update_data, headers=headers)
    
    if response.status_code == 200:
        print(f"✓ 更新会话状态成功")
        return True
    else:
        print(f"✗ 更新会话状态失败: {response.status_code}")
        print(f"  错误信息: {response.text}")
        return False

def create_raw_data(token, session_id, device_id, field_id):
    """创建原始数据"""
    print("\n创建原始数据...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # 创建5种不同类型的原始数据
    data_types = [
        {
            "data_type": "temperature",
            "data_value": "25.5",
            "data_unit": "°C",
            "data_subtype": "air_temperature"
        },
        {
            "data_type": "humidity",
            "data_value": "65.2",
            "data_unit": "%",
            "data_subtype": "relative_humidity"
        },
        {
            "data_type": "soil_ph",
            "data_value": "6.8",
            "data_unit": "pH",
            "data_subtype": "soil_ph"
        },
        {
            "data_type": "light",
            "data_value": "1200",
            "data_unit": "lux",
            "data_subtype": "light_intensity"
        },
        {
            "data_type": "ndvi",
            "data_value": "0.65",
            "data_unit": "",
            "data_subtype": "vegetation_index"
        }
    ]
    
    success_count = 0
    for i, data_type in enumerate(data_types):
        raw_data = {
            "session_id": session_id,
            "data_type": data_type["data_type"],
            "data_value": data_type["data_value"],
            "data_subtype": data_type["data_subtype"],
            "data_unit": data_type["data_unit"],
            "device_id": device_id,
            "device_display_name": "测试传感器",
            "field_id": field_id,
            "field_display_name": "API测试地块"
        }
        
        response = requests.post(f"{API_BASE_URL}/api/raw-data/", json=raw_data, headers=headers)
        
        if response.status_code == 200:
            print(f"  ✓ 创建数据 {i+1}: {data_type['data_subtype']} = {data_type['data_value']} {data_type['data_unit']}")
            success_count += 1
        else:
            print(f"  ✗ 创建数据 {i+1} 失败: {response.status_code}")
            if response.status_code == 400:
                print(f"    错误信息: {response.text}")
    
    print(f"\n原始数据创建完成，成功 {success_count}/{len(data_types)} 条")
    return success_count == len(data_types)

def get_raw_data(token, user_id):
    """获取原始数据"""
    print("\n获取原始数据...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # 根据API文档，获取原始数据列表使用 /api/raw-data/list 端点
    response = requests.get(f"{API_BASE_URL}/api/raw-data/list", 
                           params={"user_id": user_id}, 
                           headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        # 根据API文档，响应格式为 {code, message, data: {列表数据和分页信息}}
        if data.get("code") == 200:
            records = data.get("data", {}).get("records", [])
            print(f"✓ 获取原始数据成功，共 {len(records)} 条记录")
            if records:
                # 显示最近5条数据
                for i, record in enumerate(records[:5]):
                    data_type = record.get("data_subtype", "未知")
                    data_value = record.get("data_value", "")
                    data_unit = record.get("data_unit", "")
                    print(f"  - {data_type}: {data_value} {data_unit}")
            return records
        else:
            print(f"✗ 获取原始数据失败: {data.get('message', '未知错误')}")
            return []
    else:
        print(f"✗ 获取原始数据失败: {response.status_code}")
        print(f"  错误信息: {response.text}")
        return []

def test_get_field_by_id(token, field_id):
    """根据ID获取特定地块"""
    print(f"\n获取地块信息，ID: {field_id}...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(f"{API_BASE_URL}/api/fields/{field_id}", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ 获取地块成功: {data.get('name', '未命名')}")
        return data
    else:
        print(f"✗ 获取地块失败: {response.status_code}")
        print(f"  错误信息: {response.text}")
        return None

def test_get_device_by_id(token, device_id):
    """根据ID获取特定设备"""
    print(f"\n获取设备信息，ID: {device_id}...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(f"{API_BASE_URL}/api/devices/{device_id}", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ 获取设备成功: {data.get('model', '未命名')}")
        return data
    else:
        print(f"✗ 获取设备失败: {response.status_code}")
        print(f"  错误信息: {response.text}")
        return None

def test_get_session_by_id(token, session_id):
    """根据ID获取特定采集任务"""
    print(f"\n获取采集任务信息，ID: {session_id}...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(f"{API_BASE_URL}/api/collection-sessions/{session_id}", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ 获取采集任务成功: {data.get('mission_name', '未命名')}")
        return data
    else:
        print(f"✗ 获取采集任务失败: {response.status_code}")
        print(f"  错误信息: {response.text}")
        return None

def test_get_sessions_by_field(token, field_id):
    """获取指定农田的采集任务列表"""
    print(f"\n获取农田 {field_id} 的采集任务列表...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(f"{API_BASE_URL}/api/collection-sessions/field/{field_id}", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ 获取农田采集任务成功，共 {len(data)} 个任务")
        for session in data[:3]:  # 只显示前3个
            print(f"  - {session.get('mission_name', '未命名')} (状态: {session.get('status', '未知')})")
        return data
    else:
        print(f"✗ 获取农田采集任务失败: {response.status_code}")
        print(f"  错误信息: {response.text}")
        return []

def test_get_latest_session_by_field(token, field_id):
    """获取指定农田的最新采集任务"""
    print(f"\n获取农田 {field_id} 的最新采集任务...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(f"{API_BASE_URL}/api/collection-sessions/field/{field_id}/latest", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ 获取最新采集任务成功: {data.get('mission_name', '未命名')}")
        return data
    else:
        print(f"✗ 获取最新采集任务失败: {response.status_code}")
        print(f"  错误信息: {response.text}")
        return None

def test_add_raw_data_tags(token, raw_data_id):
    """添加原始数据标签"""
    print(f"\n为原始数据 {raw_data_id} 添加标签...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    tag_data = {
        "tag_category": "weather",
        "tag_value": "sunny",
        "confidence": 0.9,
        "source": "manual",
        "user_id": "1"  # 假设用户ID是1
    }
    
    response = requests.post(f"{API_BASE_URL}/api/raw-data/{raw_data_id}/tags", 
                           json=tag_data, 
                           headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        if data.get("code") == 200:
            tag_id = data.get("data", {}).get("tag_id")
            print(f"✓ 添加标签成功，标签ID: {tag_id}")
            return tag_id
        else:
            print(f"✗ 添加标签失败: {data.get('message', '未知错误')}")
            return None
    else:
        print(f"✗ 添加标签失败: {response.status_code}")
        print(f"  错误信息: {response.text}")
        return None

def test_get_raw_data_tags(token, raw_data_id):
    """获取原始数据标签"""
    print(f"\n获取原始数据 {raw_data_id} 的标签...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(f"{API_BASE_URL}/api/raw-data/{raw_data_id}/tags", 
                          params={"user_id": "1"},  # 假设用户ID是1
                          headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        if data.get("code") == 200:
            tags = data.get("data", {}).get("tags", [])
            print(f"✓ 获取标签成功，共 {len(tags)} 个标签")
            for tag in tags:
                print(f"  - {tag.get('tag_category', '未知')}: {tag.get('tag_value', '未知')}")
            return tags
        else:
            print(f"✗ 获取标签失败: {data.get('message', '未知错误')}")
            return []
    else:
        print(f"✗ 获取标签失败: {response.status_code}")
        print(f"  错误信息: {response.text}")
        return []

def main():
    """主测试流程"""
    print("=== API功能测试开始 ===")
    
    # 注册用户
    if not register_user():
        print("\n测试终止：用户注册失败")
        return
    
    # 登录获取token
    token, user_id = login_user()
    if not token:
        print("\n测试终止：用户登录失败")
        return
    
    # 创建测试地块
    field_id = create_field(token)
    if not field_id:
        print("\n测试终止：创建地块失败")
        return
    
    # 创建测试设备
    device_id = create_device(token)
    if not device_id:
        print("\n测试终止：创建设备失败")
        return
    
    # 创建测试采集会话
    session_id = create_session(token, field_id)
    if not session_id:
        print("\n测试终止：创建采集会话失败")
        return
    
    # 测试根据ID获取资源
    print("\n===== 测试根据ID获取资源 =====")
    test_get_field_by_id(token, field_id)
    test_get_device_by_id(token, device_id)
    test_get_session_by_id(token, session_id)
    
    # 获取会话列表
    sessions = get_sessions(token)
    
    # 更新会话状态为运行中
    if sessions:
        if update_session_status(token, sessions[0].get("id"), "running"):
            # 更新会话状态为已完成
            update_session_status(token, sessions[0].get("id"), "completed")
    
    # 测试与农田相关的采集任务
    print("\n===== 测试农田相关的采集任务 =====")
    test_get_sessions_by_field(token, field_id)
    test_get_latest_session_by_field(token, field_id)
    
    # 创建原始数据
    if not create_raw_data(token, session_id, device_id, field_id):
        print("\n测试终止：创建原始数据失败")
        return
    
    # 获取原始数据列表
    raw_data_records = get_raw_data(token, user_id)
    
    # 如果有原始数据，测试添加和获取标签
    if raw_data_records:
        print("\n===== 测试原始数据标签 =====")
        raw_data_id = raw_data_records[0].get("id")
        tag_id = test_add_raw_data_tags(token, raw_data_id)
        if tag_id:
            test_get_raw_data_tags(token, raw_data_id)
    
    print("\n=== API功能测试完成 ===")

if __name__ == "__main__":
    main()