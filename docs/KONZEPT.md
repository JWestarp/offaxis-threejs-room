# WiiDesktopVR → Modern Off-Axis Three.js Room
## Analyse & Neukonzeption

---

## 1. Analyse des Original WiiDesktopVR (C# / DirectX)

### 1.1 Kernkonzept
Das WiiDesktopVR-Projekt von Johnny Chung Lee demonstriert **Head-Tracked Desktop VR** – einen Effekt, bei dem der Bildschirm wie ein „Fenster in eine virtuelle Welt" wirkt, indem die Perspektive in Echtzeit an die Kopfposition des Betrachters angepasst wird.

### 1.2 Technische Komponenten

#### **Head-Tracking via Wiimote IR-Kamera**
```
┌─────────────────────────────────────────────────────────────┐
│  Wiimote (als IR-Kamera fixiert über/unter dem Monitor)     │
│                          ↓                                  │
│  Erkennt 2 IR-LEDs (Sensor Bar oder LED-Brille am Kopf)     │
│                          ↓                                  │
│  Berechnet Kopfposition aus:                                │
│  • Abstand zwischen den Punkten → Z-Distanz                 │
│  • Mittelpunkt der Punkte → X/Y-Position                    │
└─────────────────────────────────────────────────────────────┘
```

#### **Kopfpositions-Berechnung (aus WiiDesktopVR.cs)**
```csharp
// Distanz aus dem Abstand der IR-Punkte
float pointDist = sqrt(dx*dx + dy*dy);
float angle = radiansPerPixel * pointDist / 2;
headDist = (dotDistanceInMM / 2) / tan(angle) / screenHeightinMM;

// X/Y Position aus Mittelpunkt
headX = sin(radiansPerPixel * (avgX - 512)) * headDist;
headY = sin(relativeVerticalAngle + cameraVerticaleAngle) * headDist;
```

#### **Off-Axis Projektion (Kernalgorithmus)**
```csharp
// Die magische Formel für das "Fenster-in-die-Welt" Gefühl
float nearPlane = 0.05f;
Matrix.PerspectiveOffCenterLH(
    nearPlane * (-0.5f * screenAspect + headX) / headDist,  // left
    nearPlane * ( 0.5f * screenAspect + headX) / headDist,  // right
    nearPlane * (-0.5f - headY) / headDist,                  // bottom
    nearPlane * ( 0.5f - headY) / headDist,                  // top
    nearPlane,                                               // near
    100                                                      // far
);
```

### 1.3 Visualisierung
- **3D-Gitter-Raum** (Box mit Linien)
- **Schwebende Targets** (vor und hinter dem Bildschirm)
- **Verbindungslinien** zu den Targets
- **Panorama-Hintergrund** (optional)
- **Fog-Effekt** für Tiefenwahrnehmung

---

## 2. Vergleich: Original vs. Aktuelles Projekt

| Aspekt | WiiDesktopVR (2008) | Aktuelles Projekt |
|--------|---------------------|-------------------|
| **Sprache** | C# / DirectX 9 | JavaScript / Three.js |
| **Head-Tracking** | Wiimote IR-Kamera | MediaPipe Face Landmarker |
| **Tracking-Methode** | 2 IR-LEDs am Kopf | Gesichtserkennung (Augenabstand) |
| **Projektion** | `PerspectiveOffCenterLH` | `makePerspective(l,r,t,b)` |
| **Kalibrierung** | config.dat (manuell) | 5-Punkt Kalibrierung pro Distanz |
| **Plattform** | Windows Desktop | Web Browser |

### 2.1 Was bereits implementiert ist
✅ Off-Axis Projektion (`offaxis.js`)
✅ Kamera-Tracking via Webcam (`main.js` + MediaPipe)
✅ Multi-Distanz-Kalibrierung (`calib.js`)
✅ 3D-Raum-Visualisierung (`room.js`)

### 2.2 Was fehlt / verbessert werden kann
❌ Kein Smoothing/Filtering der Kopfbewegung
❌ Keine Fog-Effekte
❌ Keine schwebenden Objekte vor dem Bildschirm
❌ Kein interaktives Targeting-System
❌ Performance-Optimierung

---

## 3. Neukonzeption: Modulare Architektur

### 3.1 Vorgeschlagene Dateistruktur
```
offaxis-threejs-room/
├── index.html                 # Hauptseite
├── style.css                  # Styling
├── src/
│   ├── main.js               # Einstiegspunkt, App-Orchestrierung
│   ├── core/
│   │   ├── OffAxisCamera.js  # Off-Axis Projektion (Klasse)
│   │   ├── Screen.js         # Bildschirm-Definition
│   │   └── HeadTracker.js    # Abstract Head-Tracker Interface
│   ├── tracking/
│   │   ├── MediaPipeTracker.js    # Gesichtserkennung
│   │   ├── MouseTracker.js        # Maus-Fallback
│   │   └── WiimoteTracker.js      # Für Hardware-Enthusiasten (WebHID)
│   ├── calibration/
│   │   ├── CalibrationManager.js  # Kalibrierungs-Logik
│   │   ├── CalibrationUI.js       # UI-Komponenten
│   │   └── presets.js             # Vorkalibrierte Werte
│   ├── visualization/
│   │   ├── RoomBuilder.js         # 3D-Raum Generator
│   │   ├── GridRoom.js            # Linien-Gitter wie WiiDesktopVR
│   │   ├── FloatingTargets.js     # Schwebende Objekte
│   │   └── effects/
│   │       ├── FogEffect.js       # Tiefennebel
│   │       └── DepthLines.js      # Verbindungslinien
│   ├── ui/
│   │   ├── ControlPanel.js        # Settings-Panel
│   │   ├── DebugOverlay.js        # Debug-Anzeige
│   │   └── StatusBar.js           # Status-Leiste
│   └── utils/
│       ├── math.js                # Mathematische Hilfsfunktionen
│       ├── smoothing.js           # Filter (Kalman, Exponential)
│       └── storage.js             # LocalStorage Wrapper
└── docs/
    ├── KONZEPT.md             # Diese Datei
    └── KOOIMA_PROJECTION.md   # Mathematische Grundlagen
```

### 3.2 Kern-Klassen

#### **OffAxisCamera** (Erweiterung von offaxis.js)
```javascript
class OffAxisCamera {
  constructor(threeCamera, screen) { ... }
  
  // Kernmethode
  update(eyePosition: Vector3): void
  
  // Konfiguration
  setNearFar(near: number, far: number): void
  setClampNear(enabled: boolean): void
  
  // Debug
  getProjectionParams(): { l, r, b, t, d }
}
```

#### **HeadTracker** (Interface)
```javascript
interface HeadTracker {
  start(): Promise<void>
  stop(): void
  onUpdate(callback: (position: {x, y, z}) => void): void
  isRunning: boolean
  confidence: number
}
```

#### **Room** (Szenen-Manager)
```javascript
class Room {
  constructor(scene) { ... }
  
  // Raum-Elemente
  addGrid(config: GridConfig): void
  addFloatingTargets(count: number): void
  addFog(start: number, end: number): void
  
  // Animation
  update(deltaTime: number): void
}
```

---

## 4. Implementierungs-Roadmap

### Phase 1: Refactoring (Basis)
1. [ ] Bestehenden Code in Klassen-Struktur überführen
2. [ ] `OffAxisCamera` Klasse erstellen
3. [ ] `HeadTracker` Interface definieren
4. [ ] MediaPipe-Tracking als Klasse kapseln

### Phase 2: Features aus WiiDesktopVR
1. [ ] **Smoothing-Filter** für Kopfbewegung
   - Exponential Moving Average
   - Optional: Kalman-Filter
2. [ ] **Fog-Effekt** implementieren
   - Three.js `Fog` oder `FogExp2`
   - Dynamisch an headDist anpassen
3. [ ] **Floating Targets** 
   - Objekte vor und hinter dem Bildschirm
   - Mit Tiefenlinien wie im Original
4. [ ] **Zero-Position** (Space-Taste)
   - Aktuelle Position als Nullpunkt setzen

### Phase 3: Erweiterungen
1. [ ] **Alternative Tracker**
   - WebHID für echte Wiimotes
   - Gamepad-basiertes Tracking
2. [ ] **Performance-Modus**
   - Niedrigere Tracking-Frequenz
   - Vereinfachte Geometrie
3. [ ] **Preset-Räume**
   - WiiDesktopVR-Stil (Linien-Gitter)
   - Moderne Varianten (Solid Walls, Textured)
4. [ ] **Export/Import**
   - Kalibrierung teilen
   - Raum-Konfigurationen speichern

---

## 5. Mathematische Grundlagen

### 5.1 Off-Axis Projektion nach Kooima

Die Off-Axis (oder "Generalized Perspective") Projektion berechnet die Frustum-Grenzen basierend auf der Position des Betrachters relativ zum Bildschirm:

```
Gegeben:
- pa, pb, pc: Ecken des Bildschirms (world space)
- pe: Augenposition (world space)
- n, f: Near/Far Clipping Planes

Berechnung:
va = pa - pe  (Vektor vom Auge zur unteren-linken Ecke)
vb = pb - pe  (Vektor vom Auge zur unteren-rechten Ecke)
vc = pc - pe  (Vektor vom Auge zur oberen-linken Ecke)

vr = normalize(pb - pa)  (Bildschirm-Rechts-Vektor)
vu = normalize(pc - pa)  (Bildschirm-Hoch-Vektor)
vn = normalize(cross(vr, vu))  (Bildschirm-Normal)

d = -dot(va, vn)  (Abstand Auge zu Bildschirmebene)

l = dot(vr, va) * n/d  (linke Frustum-Grenze)
r = dot(vr, vb) * n/d  (rechte Frustum-Grenze)
b = dot(vu, va) * n/d  (untere Frustum-Grenze)
t = dot(vu, vc) * n/d  (obere Frustum-Grenze)

Projektionsmatrix = makePerspective(l, r, b, t, n, f)
```

### 5.2 Kopfpositions-Schätzung aus Augenabstand

```
Ähnlichkeitsprinzip:
realEyeDistance ≈ 63mm (konstant)
pixelEyeDistance = gemessen in Webcam-Bild

z_meters = (realEyeDistance * focalLength) / pixelEyeDistance

Kalibrierung interpoliert zwischen bekannten Distanzen.
```

---

## 6. Nächste Schritte

1. **Dieses Konzept reviewen** und anpassen
2. **Phase 1 starten**: Refactoring in Klassen
3. **Smoothing implementieren** (sofortiger UX-Gewinn)
4. **WiiDesktopVR-Raum** als alternativen Raum-Stil hinzufügen

---

*Erstellt: Januar 2026*
*Basierend auf: WiiDesktopVR von Johnny Chung Lee (2008)*
