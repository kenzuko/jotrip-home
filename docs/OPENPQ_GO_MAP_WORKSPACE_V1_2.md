# Open Phu Quoc /go V1.2 - Discovery Map Workspace

Date: 25/09/2026

## Design

- Desktop (>=761px): left rail = origin + radius + map layers + sort; right workspace = map + visible sorted shortlist.
- Mobile: existing stacked interactions and five-tab shared CMS navigation; map follows the compact controls.
- The second and third questions (time and experience type) remain underneath; map layers are for **exploration**, not an independent operating-status provider.

## Origin when GPS is not enabled

1. **Manual area** (default): Dương Đông / An Thới / Bắc đảo. Radar uses an explicitly named **reference area center**. The Go engine filters recommended activities by zone and time, not by a fictitious precise origin.
2. **Tap on the map**: the user explicitly enables "Chọn điểm trên bản đồ" and taps a point. Radar and Go engine can then use its geodesic radius from this **user-chosen reference**, which is never labelled GPS.
3. **GPS**: the user explicitly presses "Dùng vị trí của tôi". Denial, timeout or missing browser support leaves the manual modes available. GPS stays in session memory only.

The map clearly distinguishes the three modes. Distances and radar circles are **straight-line kilometres**, never driving distance or travel time.

## Layers and sorting

The map uses `data/views/location-index.json` as the preferred public geo index, falling back to canonical entities for missing IDs. Layer switching uses pure `core/go-layers.js`:

- Khám phá (default): place + activity
- Điểm đến
- Trải nghiệm
- Tiện ích
- Lưu trú
- Ăn uống
- Tất cả

Sorting offers distance from selected center and A-Z; the shortlist and marker presentation use the same filtered items. Verified `map.precision` is required for all pins. Area anchors are displayed as regional reference pins, not venue entrance points.

**Near Me food:** LOCAL_FOOD / RESTAURANT / CAFE are currently directory-search categories. The canonical stored venue set contains no verified food venue pins. The food layer therefore shows a truthful empty state and direct Near Me directory action rather than inventing restaurant locations. It will automatically gain pins when the canonical venue directory contains verified food records.

## Invariants

- No weather, transit or operational-status model duplication.
- No automatic geolocation requests.
- No user coordinates stored permanently or sent to a separate service by /go's own application code.
- No estimated road ETA from a geodesic circle.
- Map data errors never disable the manual-zone activity picker.
- Leaflet + OpenStreetMap for map tiles, with proper attribution.
