// TV5: chuyển dữ liệu MySQL sang hợp đồng JSON tuần 1, không thay đổi schema.
function toIso(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  const date = new Date(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(text)
    ? text.replace(" ", "T") + "+07:00" : text);
  if (Number.isNaN(date.getTime())) throw new Error("Ngày giờ trong database không hợp lệ");
  return date.toISOString();
}
function toUser(row) {
  return {
    id: Number(row.id), full_name: row.full_name, email: row.email,
    phone: row.phone, avatar: row.avatar, role: row.role, status: row.status,
    created_at: toIso(row.created_at),
  };
}
module.exports = { toIso, toUser };
