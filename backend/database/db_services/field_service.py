from sqlalchemy import Column, and_, or_, func, text
from sqlalchemy.orm import Session
from database.db_models.field_model import Field
import uuid
from typing import Optional, List, Union

# 尝试导入GeoAlchemy2函数
try:
    from geoalchemy2.functions import ST_GeomFromText, ST_Area, ST_AsText, ST_Contains, ST_SetSRID, ST_MakePoint
    HAS_POSTGIS = True
except ImportError:
    HAS_POSTGIS = False

def create_field(db: Session, name: str, description: str = "", 
                location_geom: str = "", area_m2: float = 0.0, 
                crop_type: str = "", soil_type: str = "", 
                irrigation_type: str = "", owner_id: str = "",
                organization_id: str = "") -> Field:
    """
    创建新地块
    
    Args:
        db: 数据库会话
        name: 地块名称
        description: 地块描述（可选）
        location_geom: 农田边界（几何数据，WKT格式）
        area_m2: 农田面积（可选）
        crop_type: 作物类型（可选）
        soil_type: 土壤类型（可选）
        irrigation_type: 灌溉方式（可选）
        owner_id: 地块负责人ID（可选）
        organization_id: 所属组织ID（可选）
    
    Returns:
        Field: 创建的地块对象
    """
    print(f"[后端FieldService] 开始创建地块: 名称={name}, 所有者ID={owner_id}, PostGIS支持={HAS_POSTGIS}")
    
    # 处理几何数据
    geometry_obj = location_geom
    if HAS_POSTGIS and location_geom and isinstance(location_geom, str):
        # 不直接创建几何对象，而是在SQL中转换
        needs_geom_conversion = True
    else:
        needs_geom_conversion = False
    
    # 创建新地块
    print("[后端FieldService] 创建新地块对象")
    new_field = Field(
        name=name,
        description=description,
        location_geom=geometry_obj,
        area_m2=area_m2,
        crop_type=crop_type,
        soil_type=soil_type,
        irrigation_type=irrigation_type,
        owner_id=owner_id,
        organization_id=organization_id
    )
    
    print(f"[后端FieldService] 地块对象创建成功, id={new_field.id}")
    
    # 保存到数据库
    print("[后端FieldService] 保存地块到数据库")
    db.add(new_field)
    db.commit()
    
    # 如果需要转换几何数据（PostGIS且WKT字符串）
    if HAS_POSTGIS and 'needs_geom_conversion' in locals() and needs_geom_conversion:
        print("[后端FieldService] 转换几何数据")
        db.execute(
            text("UPDATE field SET location_geom = ST_GeomFromText(:wkt, 4326) WHERE id = :field_id"),
            {"wkt": location_geom, "field_id": new_field.id}
        )
        db.commit()
    
    # 如果未提供面积但提供了位置几何，则计算面积
    if not area_m2:
        print("[后端FieldService] 计算地块面积")
        calculate_and_update_area(db, new_field.id) # type: ignore
    
    # 刷新对象以获取更新后的值
    db.refresh(new_field)
    
    print(f"[后端FieldService] 地块保存成功: {new_field.id}")
    return new_field

def calculate_and_update_area(db: Session, field_id: str) -> Optional[float]:
    """
    计算并更新地块面积
    
    Args:
        db: 数据库会话
        field_id: 地块ID
    
    Returns:
        float: 计算出的面积（平方米）
    """
    try:
        if HAS_POSTGIS:
            # 直接使用原始SQL查询，避免ORM缓存问题
            result = db.execute(
                text("""
                    UPDATE field 
                    SET area_m2 = ST_Area(location_geom::geography) 
                    WHERE id = :field_id 
                    RETURNING area_m2
                """),
                {"field_id": field_id}
            ).scalar()
            
            if result:
                db.commit()
                print(f"[后端FieldService] 地块面积已更新: {result} 平方米")
                return result
        else:
            # 无PostGIS时的提示
            print("[后端FieldService] PostGIS不可用，无法自动计算地块面积")
            
    except Exception as e:
        print(f"[后端FieldService] 计算地块面积失败: {e}")
        # 回滚事务
        db.rollback()
    
    return None

def get_field_by_id(db: Session, field_id: str) -> Optional[Field]:
    """
    根据地块ID获取地块信息
    
    Args:
        db: 数据库会话
        field_id: 地块ID
    
    Returns:
        Field: 地块对象，不存在返回None
    """
    return db.query(Field).filter(Field.id == field_id).first()

def get_field_with_wkt(db: Session, field_id: str) -> Optional[dict]:
    """
    根据地块ID获取地块信息，包含WKT格式的几何数据
    
    Args:
        db: 数据库会话
        field_id: 地块ID
    
    Returns:
        dict: 包含地块信息的字典，几何数据以WKT格式提供
    """
    if HAS_POSTGIS:
        # 使用PostGIS函数获取WKT
        result = db.query(
            Field.id, Field.name, Field.description, Field.area_m2,
            Field.crop_type, Field.soil_type, Field.irrigation_type,
            Field.owner_id, Field.organization_id, Field.is_active,
            Field.created_at, Field.updated_at,
            func.ST_AsText(Field.location_geom).label('location_wkt')
        ).filter(Field.id == field_id).first()
    else:
        # 直接返回文本字段
        result = db.query(
            Field.id, Field.name, Field.description, Field.area_m2,
            Field.crop_type, Field.soil_type, Field.irrigation_type,
            Field.owner_id, Field.organization_id, Field.is_active,
            Field.created_at, Field.updated_at,
            Field.location_geom.label('location_wkt')
        ).filter(Field.id == field_id).first()
    
    if result:
        return {
            'id': str(result.id),
            'name': result.name,
            'description': result.description,
            'area_m2': result.area_m2,
            'crop_type': result.crop_type,
            'soil_type': result.soil_type,
            'irrigation_type': result.irrigation_type,
            'owner_id': str(result.owner_id) if result.owner_id else None,
            'organization_id': str(result.organization_id) if result.organization_id else None,
            'is_active': result.is_active,
            'created_at': result.created_at,
            'updated_at': result.updated_at,
            'location_wkt': result.location_wkt
        }
    return None

def get_fields_by_owner(db: Session, owner_id: str, active_only: bool = True) -> List[Field]:
    """
    根据所有者ID获取地块列表
    
    Args:
        db: 数据库会话
        owner_id: 所有者ID
        active_only: 是否只获取活跃地块，默认为True
    
    Returns:
        List[Field]: 地块列表
    """
    query = db.query(Field).filter(Field.owner_id == owner_id)
    
    if active_only:
        query = query.filter(Field.is_active == True)
    
    return query.all()

def get_fields_by_owner_with_wkt(db: Session, owner_id: str, active_only: bool = True) -> List[dict]:
    """
    根据所有者ID获取地块列表，包含WKT格式的几何数据
    
    Args:
        db: 数据库会话
        owner_id: 所有者ID
        active_only: 是否只获取活跃地块，默认为True
    
    Returns:
        List[dict]: 包含地块信息的字典列表，几何数据以WKT格式提供
    """
    if HAS_POSTGIS:
        # 使用PostGIS函数获取WKT
        query = db.query(
            Field.id, Field.name, Field.description, Field.area_m2,
            Field.crop_type, Field.soil_type, Field.irrigation_type,
            Field.owner_id, Field.organization_id, Field.is_active,
            Field.created_at, Field.updated_at,
            func.ST_AsText(Field.location_geom).label('location_wkt')
        ).filter(Field.owner_id == owner_id)
    else:
        # 直接返回文本字段
        query = db.query(
            Field.id, Field.name, Field.description, Field.area_m2,
            Field.crop_type, Field.soil_type, Field.irrigation_type,
            Field.owner_id, Field.organization_id, Field.is_active,
            Field.created_at, Field.updated_at,
            Field.location_geom.label('location_wkt')
        ).filter(Field.owner_id == owner_id)
    
    if active_only:
        query = query.filter(Field.is_active == True)
    
    results = query.all()
    
    fields = []
    for result in results:
        fields.append({
            'id': str(result.id),
            'name': result.name,
            'description': result.description,
            'area_m2': result.area_m2,
            'crop_type': result.crop_type,
            'soil_type': result.soil_type,
            'irrigation_type': result.irrigation_type,
            'owner_id': str(result.owner_id) if result.owner_id else None,
            'organization_id': str(result.organization_id) if result.organization_id else None,
            'is_active': result.is_active,
            'created_at': result.created_at,
            'updated_at': result.updated_at,
            'location_wkt': result.location_wkt
        })
    
    return fields

def get_fields_by_organization(db: Session, organization_id: str, active_only: bool = True) -> List[Field]:
    """
    根据组织ID获取地块列表
    
    Args:
        db: 数据库会话
        organization_id: 组织ID
        active_only: 是否只获取活跃地块，默认为True
    
    Returns:
        List[Field]: 地块列表
    """
    query = db.query(Field).filter(Field.organization_id == organization_id)
    
    if active_only:
        query = query.filter(Field.is_active == True)
    
    return query.all()

def get_all_fields(db: Session, active_only: bool = True) -> List[Field]:
    """
    获取所有地块
    
    Args:
        db: 数据库会话
        active_only: 是否只获取活跃地块，默认为True
    
    Returns:
        List[Field]: 地块列表
    """
    query = db.query(Field)
    
    if active_only:
        query = query.filter(Field.is_active == True)
    
    return query.all()

def search_fields(db: Session, owner_id: str = "", organization_id: str = "",
                 keyword: str = "", crop_type: str = "", 
                 soil_type: str = "", irrigation_type: str = "",
                 active_only: bool = True) -> List[Field]:
    """
    根据条件搜索地块
    
    Args:
        db: 数据库会话
        owner_id: 所有者ID（可选）
        organization_id: 组织ID（可选）
        keyword: 关键词（搜索名称和描述）
        crop_type: 作物类型（可选）
        soil_type: 土壤类型（可选）
        irrigation_type: 灌溉方式（可选）
        active_only: 是否只获取活跃地块，默认为True
    
    Returns:
        List[Field]: 搜索结果
    """
    query = db.query(Field)
    
    if active_only:
        query = query.filter(Field.is_active == True)
    
    if owner_id:
        query = query.filter(Field.owner_id == owner_id)
    
    if organization_id:
        query = query.filter(Field.organization_id == organization_id)
    
    if keyword:
        search_filter = or_(
            Field.name.ilike(f"%{keyword}%"),
            Field.description.ilike(f"%{keyword}%")
        )
        query = query.filter(search_filter)
    
    if crop_type:
        query = query.filter(Field.crop_type == crop_type)
    
    if soil_type:
        query = query.filter(Field.soil_type == soil_type)
    
    if irrigation_type:
        query = query.filter(Field.irrigation_type == irrigation_type)
    
    return query.all()

def find_fields_containing_point(db: Session, longitude: float, latitude: float, 
                              owner_id: str = "", organization_id: str = "",
                              active_only: bool = True) -> List[Field]:
    """
    查找包含指定点的地块
    
    Args:
        db: 数据库会话
        longitude: 经度
        latitude: 纬度
        owner_id: 所有者ID（可选）
        organization_id: 组织ID（可选）
        active_only: 是否只获取活跃地块，默认为True
    
    Returns:
        List[Field]: 包含该点的地块列表
    """
    if not HAS_POSTGIS:
        print("[后端FieldService] PostGIS不可用，无法执行空间查询")
        return []
    
    # 创建点几何
    point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) # type: ignore
    
    query = db.query(Field).filter(func.ST_Contains(Field.location_geom, point))
    
    if active_only:
        query = query.filter(Field.is_active == True)
    
    if owner_id:
        query = query.filter(Field.owner_id == owner_id)
    
    if organization_id:
        query = query.filter(Field.organization_id == organization_id)
    
    return query.all()

def update_field(db: Session, field_id: str, owner_id: str = "", organization_id: str = "",
                name: str = "", description: str = "", 
                location_geom: str = "", area_m2: float = 0.0, 
                crop_type: str = "", soil_type: str = "", 
                irrigation_type: str = "", is_active: bool = False) -> Optional[Field]:
    """
    更新地块信息
    
    Args:
        db: 数据库会话
        field_id: 地块ID
        owner_id: 所有者ID（用于验证权限，可选）
        organization_id: 组织ID（用于验证权限，可选）
        name: 新名称（可选）
        description: 新描述（可选）
        location_geom: 新位置几何（可选，WKT格式）
        area_m2: 新面积（可选）
        crop_type: 新作物类型（可选）
        soil_type: 新土壤类型（可选）
        irrigation_type: 新灌溉方式（可选）
        is_active: 新状态（可选）
    
    Returns:
        Field: 更新后的地块对象，不存在或无权限返回None
    """
    print(f"[后端FieldService] 开始更新地块: ID={field_id}, PostGIS支持={HAS_POSTGIS}")
    
    # 构建查询条件
    conditions = [Field.id == field_id]
    
    if owner_id:
        conditions.append(Field.owner_id == owner_id)
    
    if organization_id:
        conditions.append(Field.organization_id == organization_id)
    
    # 查找地块
    field = db.query(Field).filter(and_(*conditions)).first()
    if not field:
        print("[后端FieldService] 地块不存在或无权限访问")
        return None
    
    # 准备更新数据
    update_data = {}
    
    if name is not None:
        update_data["name"] = name
    if description is not None:
        update_data["description"] = description
    
    # 处理几何数据更新
    if location_geom is not None:
        if HAS_POSTGIS and isinstance(location_geom, str):
            # 不直接存储，而是使用SQL函数在数据库中转换
            # 先保存字段，然后使用SQL更新几何数据
            print("[后端FieldService] 将在SQL中转换几何数据")
            # 记录需要更新几何数据，但不包含在update_data中
            needs_geom_update = True
        elif HAS_POSTGIS:
            # 已经是几何对象，直接更新
            update_data["location_geom"] = location_geom
        else:
            # 无PostGIS，直接存储文本
            update_data["location_geom"] = location_geom
    else:
        needs_geom_update = False
    
    if area_m2 is not None:
        update_data["area_m2"] = area_m2
    if crop_type is not None:
        update_data["crop_type"] = crop_type
    if soil_type is not None:
        update_data["soil_type"] = soil_type
    if irrigation_type is not None:
        update_data["irrigation_type"] = irrigation_type
    if is_active is not None:
        update_data["is_active"] = is_active
    
    # 执行更新
    if update_data:
        print(f"[后端FieldService] 更新字段: {list(update_data.keys())}")
        db.query(Field).filter(and_(*conditions)).update(update_data)
        db.commit()
        # 刷新对象以获取更新后的值
        db.refresh(field)
    
    # 如果需要更新几何数据（PostGIS且WKT字符串）
    if HAS_POSTGIS and 'needs_geom_update' in locals() and needs_geom_update: # type: ignore
        print("[后端FieldService] 更新几何数据")
        db.execute(
            text("UPDATE field SET location_geom = ST_GeomFromText(:wkt, 4326) WHERE id = :field_id"),
            {"wkt": location_geom, "field_id": field_id}
        )
        db.commit()
        
        # 如果更新了几何但未提供面积，则需要重新计算面积
        if area_m2 is None:
            print("[后端FieldService] 几何数据已更新，将重新计算面积")
            calculate_and_update_area(db, field_id)
    
    # 刷新对象以获取更新后的值
    db.refresh(field)
    
    print(f"[后端FieldService] 地块更新成功: {field.id}")
    return field

def delete_field(db: Session, field_id: str, owner_id: str = "", 
                organization_id: str = "", soft_delete: bool = True) -> bool:
    """
    删除地块
    
    Args:
        db: 数据库会话
        field_id: 地块ID
        owner_id: 所有者ID（用于验证权限，可选）
        organization_id: 组织ID（用于验证权限，可选）
        soft_delete: 是否使用软删除（默认为True，只标记为不活跃）
    
    Returns:
        bool: 删除是否成功
    """
    print(f"[后端FieldService] 开始删除地块: ID={field_id}")
    
    # 构建查询条件
    conditions = [Field.id == field_id]
    
    if owner_id:
        conditions.append(Field.owner_id == owner_id)
    
    if organization_id:
        conditions.append(Field.organization_id == organization_id)
    
    # 查找地块
    field = db.query(Field).filter(and_(*conditions)).first()
    if not field:
        print("[后端FieldService] 地块不存在或无权限访问")
        return False
    
    if soft_delete:
        # 软删除：标记为不活跃
        print("[后端FieldService] 执行软删除")
        field.is_active = False # type: ignore
        db.commit()
    else:
        # 硬删除：从数据库中删除
        print("[后端FieldService] 执行硬删除")
        db.delete(field)
        db.commit()
    
    print(f"[后端FieldService] 地块删除成功: {field_id}")
    return True

def restore_field(db: Session, field_id: str, owner_id: str = "", 
                organization_id: str = "") -> Optional[Field]:
    """
    恢复已软删除的地块
    
    Args:
        db: 数据库会话
        field_id: 地块ID
        owner_id: 所有者ID（用于验证权限，可选）
        organization_id: 组织ID（用于验证权限，可选）
    
    Returns:
        Field: 恢复后的地块对象，不存在或无权限返回None
    """
    print(f"[后端FieldService] 开始恢复地块: ID={field_id}")
    
    # 构建查询条件
    conditions = [
        Field.id == field_id,
        Field.is_active == False
    ]
    
    if owner_id:
        conditions.append(Field.owner_id == owner_id)
    
    if organization_id:
        conditions.append(Field.organization_id == organization_id)
    
    # 查找已软删除的地块
    field = db.query(Field).filter(and_(*conditions)).first()
    
    if not field:
        print("[后端FieldService] 已删除的地块不存在或无权限访问")
        return None
    
    # 恢复地块
    print("[后端FieldService] 恢复地块")
    field.is_active = True # type: ignore
    db.commit()
    db.refresh(field)
    
    print(f"[后端FieldService] 地块恢复成功: {field.id}")
    return field