import pytest
from fastapi import HTTPException

# 注意：routes/field.py 中的变量名是 `router`，不是 `field_router`
from api.routes.field import validate_bbox, router
from database.db_services.field_service import _parse_wkt_ring


def test_parse_wkt_ring_reads_the_outer_ring():
    ring = _parse_wkt_ring(
        "POLYGON((116.0 39.9, 116.1 39.9, 116.1 40.0, 116.0 39.9))"
    )
    assert ring == [(116.0, 39.9), (116.1, 39.9), (116.1, 40.0), (116.0, 39.9)]


def test_parse_wkt_ring_returns_empty_for_junk():
    assert _parse_wkt_ring("") == []
    assert _parse_wkt_ring("POINT(116 39)") == []
    assert _parse_wkt_ring(None) == []


def test_validate_bbox_accepts_a_normal_box():
    validate_bbox(116.0, 39.9, 116.5, 40.2)  # 不抛异常


def test_validate_bbox_rejects_inverted_bounds():
    with pytest.raises(HTTPException) as exc:
        validate_bbox(116.5, 39.9, 116.0, 40.2)
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        validate_bbox(116.0, 40.2, 116.5, 39.9)
    assert exc.value.status_code == 400


def test_validate_bbox_rejects_out_of_range_coordinates():
    with pytest.raises(HTTPException) as exc:
        validate_bbox(116.0, 91.0, 116.5, 92.0)
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        validate_bbox(-181.0, 39.9, 116.5, 40.2)
    assert exc.value.status_code == 400


def test_light_and_geometry_are_registered_before_the_path_param_route():
    """
    回归保护：/fields/light 与 /fields/geometry 若注册在 /fields/{field_id} 之后，
    会被路径参数路由吞掉而永远命中不到。
    """
    # APIRouter(prefix="/fields") 会把前缀写进 route.path，故这里是 "/fields/light" 全路径
    paths = [r.path for r in router.routes]
    assert "/fields/light" in paths
    assert "/fields/geometry" in paths
    assert paths.index("/fields/light") < paths.index("/fields/{field_id}")
    assert paths.index("/fields/geometry") < paths.index("/fields/{field_id}")
