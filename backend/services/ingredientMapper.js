function getRawMaterialId(ingredient) {
  return ingredient.raw_material_id || ingredient.material_id || null;
}

function mapIngredientForInsert(menuId, ingredient, rawMaterial = null, availability = null) {
  const rawMaterialId = getRawMaterialId(ingredient);
  const name = rawMaterial?.name || ingredient.nama_bahan;
  const unit = ingredient.satuan || rawMaterial?.unit;
  const price = ingredient.harga_satuan ?? rawMaterial?.standard_price ?? 0;

  return [
    menuId,
    ingredient.bahan_baku_ref_id || null,
    rawMaterialId,
    name,
    ingredient.jumlah,
    unit,
    price,
    rawMaterial?.unit || ingredient.unit_snapshot || unit || null,
    rawMaterial?.quality_status || ingredient.quality_status_snapshot || null,
    availability?.status || ingredient.availability_status_snapshot || null,
    rawMaterial?.price_updated_at || ingredient.price_updated_at_snapshot || null,
    availability?.checked_at ? new Date(availability.checked_at) : ingredient.stock_checked_at || null,
  ];
}

module.exports = {
  getRawMaterialId,
  mapIngredientForInsert,
};
