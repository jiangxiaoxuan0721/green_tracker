/** 经纬度点，恒为 [经度, 纬度] */
export type LngLat = [number, number]

/** [[minLng, minLat], [maxLng, maxLat]] */
export type Bounds = [LngLat, LngLat]
