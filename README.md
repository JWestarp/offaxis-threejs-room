# Off-Axis Room (three.js + MediaPipe Face Landmarker) — Entwickler-README
Dieses Repo ist ein **Mini‑Prototyp** für eine *Head‑Coupled Perspective* (HCP):
Die Szene wird so gerendert, als wäre der Bildschirm eine **durchsichtige Scheibe**, hinter der sich ein ca. **50 cm tiefer Raum** befindet.
Wenn du den Kopf nach links/rechts bewegst, soll sich die perspektivische Projektion so verschieben, dass
- die **nahe Ecke auf der abgewandten Seite “aus dem Sichtfeld rutscht”**,
- die **gegenüberliegende Ecke** scheinbar **zur Bildschirmmitte wandert**,
- und das Ganze wie ein “Karton hinter dem Monitor” wirkt (siehe Ziel‑Grafik).
Der Kern ist eine **asymmetrische (off‑axis) Projektionsmatrix**, wie im Unity‑Artikel beschrieben.
---
## 1) Konzept & Zielbild
### Was wir simulieren
- **Bildschirm = Projektionsfenster** (physische Fläche im Raum)
- **Auge = Projektionszentrum** (viewOrigin / eye point)
- **Virtueller Raum** liegt *hinter* dem Bildschirm (negative Z‑Tiefe), z.B.
  `screen plane z = 0` und Raumtiefe bis `z = -0.50 m`.
### Warum off-axis?
Eine normale PerspectiveCamera nimmt implizit an, dass das Auge genau auf der Bildschirmnormalen sitzt (on-axis).
Sobald der Kopf seitlich versetzt ist, wäre die geometrisch korrekte Projektion aber ein **asymmetrisches Frustum**, dessen linke/rechte/top/bottom‑Grenzen *nicht* symmetrisch sind.
---
## 2) Physikalische Modellierung
### Einheiten & Koordinatensystem
- **Meter** als Welt‑Einheit (wichtig für stabile Tiefenwirkung)
- Achsen (Konvention in diesem Projekt):
  - **X**: nach rechts
  - **Y**: nach oben
  - **Z**: **zum User hin** (Auge vor dem Bildschirm hat `z > 0`)
- Bildschirm liegt in der Ebene `z = 0`, Szene/“Karton” dahinter: `z < 0`.
### Physische Display-Maße (MacBook Pro 16")
Für Defaults orientieren wir uns an den Apple‑Specs (16.2" diagonal, 3456×2234 @ 254 ppi).
Daraus ergibt sich näherungsweise:
- **Breite ≈ 34.56 cm**
- **Höhe ≈ 22.34 cm**
> Hinweis: Browser‑Fullscreen und macOS‑Scaling ändern die *Pixelanzahl*, aber nicht die physische Größe.
### Betrachtungsabstand
Du peilst ~**50 cm** an (passt auch zu ergonomischen Richtwerten “arm’s length”).
In der Praxis ist der effektive Abstand dynamisch – daher unser Z‑Kalibrierungsmodell (siehe unten).
---
## 3) Mathematische Grundlage (Off‑Axis / Generalized Perspective)
### 3.1 Screen‑Geometrie als Basis
Wir beschreiben den Bildschirm als 3D‑Rechteck mit 4 Ecken:
- `pa`: bottom‑left
- `pb`: bottom‑right
- `pc`: top‑left
- `pd`: top‑right
und als normierte Basisvektoren:
- `vr` = (pb − pa) / |pb − pa|  → “right”
- `vu` = (pc − pa) / |pc − pa|  → “up”
- `vn` = normalize(vr × vu)      → “normal”
Im aktuellen Prototyp ist der Screen **achsenparallel**, daher sind `vr=(1,0,0)`, `vu=(0,1,0)` und `vn=(0,0,1)`.
### 3.2 Eye→Corner‑Vektoren
Auge `pe` (eyeWorld) → Screen‑Ecken:
- `va = pa − pe`
- `vb = pb − pe`
- `vc = pc − pe`
### 3.3 Abstand Auge → Screen‑Ebene
Der senkrechte Abstand (signed) ist:
`d = - dot(va, vn)`
Damit ist `d > 0`, wenn das Auge **vor** dem Screen liegt (in Richtung `+vn`).
### 3.4 Asymmetrische Frustum‑Grenzen
Wir definieren Near/Far und projizieren die Screen‑Ecken auf die Near‑Plane:
```
nearOverDist = near / d
l = dot(vr, va) * nearOverDist
r = dot(vr, vb) * nearOverDist
b = dot(vu, va) * nearOverDist
t = dot(vu, vc) * nearOverDist
```
Das entspricht dem Vorgehen im Unity‑Artikel (Kooima‑basiert).
### 3.5 Projection Matrix in three.js
three.js erlaubt eine manuelle Perspektivmatrix über:
`Matrix4.makePerspective(left, right, top, bottom, near, far)`
Im Code passiert dann:
- `camera.projectionMatrix.copy(P)`
- `camera.projectionMatrixInverse.copy(P).invert()`
- `camera.position = eyeWorld` (Rotation bleibt parallel zum Screen; kein `lookAt`)
> Wichtig: Wir rotieren **weder** die Szene **noch** die Kamera via Parent‑Tricks.
> Die Tiefenillusion entsteht rein aus der korrekten Projektion und dem verschobenen Eye‑Point.
---
## 4) Head Tracking → viewOrigin (MediaPipe Face Landmarker)
Wir nutzen **MediaPipe Face Landmarker** (Web/JS) als Tracking‑Quelle.
### Welche Werte wir brauchen
Für die Off‑Axis‑Matrix benötigen wir **Auge in Screen‑Meterkoordinaten**:
`eyeWorld = (xM, yM, zM)`.
MediaPipe liefert Landmarks (u.a. Augenpunkte) als **normalized screen space** + ein relatives **z**.
Das reicht alleine nicht für echte Meter‑Koordinaten, deshalb ist in diesem Prototyp ein **Kalibrierungs-/Mapping‑Layer** dazwischen.
### Performance-Hinweis
`detectForVideo()` läuft synchron und kann den UI‑Thread blockieren – perspektivisch lohnt ein Web‑Worker‑Setup.
---
## 5) Kalibrierung (warum & wie)
### Problem: Z ist nicht metrisch
Ohne Kamera‑Intrinsics / echte Depth‑Info ist “wie weit ist der Kopf weg?” schwer.
Dieser Prototyp nutzt daher ein praktisches Proxy‑Signal:
**Augenabstand in Pixeln** (`eyeDistPx`)
→ je näher der Kopf, desto größer wirkt der Augenabstand im Bild.
### Unser Ansatz: mehrere Z‑Slots + Position‑Samples
Der UI‑Workflow erlaubt:
- **mehrere Z‑Distanzen** (z.B. 0.40m / 0.50m / 0.60m)
- pro Slot mehrere **Posen**:
  - `center`, `left`, `right`, `up`, `down`
Aus diesen Samples entsteht je Slot ein Bereich:
- `xMin..xMax` und `yMin..yMax` in normalized Landmark‑Koordinaten
Das Mapping ist dann:
- `xNorm -> xM` linear zwischen `[-screenW/2.. +screenW/2]`
- `yNorm -> yM` linear zwischen `[-screenH/2.. +screenH/2]`
- `zM` wird über **Interpolation zwischen Slots** bestimmt:
  - aktuelles `eyeDistPx` wird zwischen den Slots “gebracketed”
  - daraus `t` (0..1) und `zM = lerp(zA, zB, t)`
### Warum mehrere Slots?
Ein einzelner Messpunkt reicht oft nicht:
- Gesicht ↔ Kamera hat Verzerrung (Weitwinkel, Perspektive)
- Kopfneigung verändert Landmark‑Scale leicht
- individuelle Gesichtsgeometrie variiert
Mehrere Z‑Referenzen stabilisieren das System und machen es “kalibrierbar” statt “magisch”.
---
## 6) Projektstruktur
```
offaxis-threejs-room-v3/
  index.html        # UI + Canvas + Video
  style.css         # Layout/Overlay
  main.js           # App-Orchestrierung: Scene, Renderloop, FaceLandmarker, UI
  room.js           # Raum-/Grid-Geometrie (Karton) + Debug-Overlays
  offaxis.js        # Off-Axis-Frustum: berechnet l/r/t/b und setzt projectionMatrix
  calib.js          # Slots/Samples, Mapping, Interpolation, Utility
  README.md         # (dieses Dokument)
```
---
## 7) Lauf & Debug
### Starten (lokal)
Du brauchst einen lokalen HTTP‑Server (wegen Webcam‑Permissions).
Beispiel:
- `python3 -m http.server 8080`
- dann `http://localhost:8080/offaxis-threejs-room-v3/`
### Debug-Visuals
Der Prototyp enthält optional:
- Screen‑Outline (physische Screen‑Ecken)
- Eye‑Marker
- Frustum‑Rays (Eye → Screen corners)
Diese sind extrem hilfreich, um zu prüfen, ob:
- `eyeWorld` plausibel ist (z.B. `zM ~ 0.5`)
- das Frustum wirklich “schief” wird, wenn du seitlich gehst
---
## 8) Typische Fehlerbilder & Ursachen
### “Nichts bewegt sich / wirkt flach”
- Off‑axis Matrix wird nicht gesetzt (z.B. Tracking nicht aktiv)
- Eye‑Z ist zu groß/klein → Frustum wird numerisch “neutral”
- Room‑Tiefe ist zu gering / fehlende Grid‑Cues
### “Alles zittert”
- Tracking noisig → Smoothing erhöhen
- Kalibrier‑Samples zu knapp (extrem links/rechts/up/down nicht sauber aufgenommen)
- Lichtverhältnisse / Kameraqualität
### “Ecke verschwindet nicht wie erwartet”
- Screen‑Maße falsch (screenW/screenH)
- `mirrorX` falsch (Frontkamera ist oft gespiegelt)
- Koordinaten‑Vorzeichen bei Z nicht konsistent (Auge muss vor dem Screen liegen: `z>0`)
---
## 9) Roadmap (Weiterentwicklung)
### Phase A — Physik sauber machen (1:1 mit realem Screen)
1. **Screen‑Maße robust erfassen**
   - Defaults (MBP 16") beibehalten
   - Optional: “Measure Mode” (User misst Breite/Höhe mit Lineal und trägt cm ein)
2. **Near‑Plane Strategie**
   - Option “Clamp near to screen plane” (wie im Unity‑Artikel) für korrekte Clip‑Kante.
3. **Numerische Stabilität**
   - Guards: `d` darf nie 0 werden; Near/Far sanity checks
   - harte Limits für `zM` (z.B. 0.25–1.2m)
### Phase B — Tracking/Calibration verbessern (weniger “Handarbeit”)
1. **Besseres Z‑Signal**
   - optional: MediaPipe “facial transformation matrices” (Pose/Scale) auswerten, statt nur eyeDistPx.
2. **Kalibrier‑UX**
   - guided flow (Countdown, “halte still”, 3 Samples mitteln)
   - Persistenz (LocalStorage: Slots & Samples speichern)
3. **Multi‑Point Calibration**
   - zusätzlich diagonale Positionen (up-left / up-right / …)
   - damit nichtlinearer Mapping‑Warp (2D bilinear / thin-plate spline)
### Phase C — Visuelle Robustheit (damit es “wie im Ziel” wirkt)
1. **Räumliche Cues**
   - stärkere lineare Perspektiv‑Cues (Grid‑Dichte, klare Kanten)
   - dezente AO/Shadow (aber keine PostFX, solange Off‑Axis‑Matrix noch “roh” ist)
2. **Depth Budget**
   - Raumtiefe 0.50m als Default, aber UI‑Slider: 0.2–1.0m
3. **Kalibrier‑Testpattern**
   - “Corner Rods” / Alignment‑Cube wie im Unity‑Artikel zur visuellen Prüfung.
### Phase D — Technik/Produktivisierung
1. **Web Worker für FaceLandmarker** (UI bleibt flüssig)
2. **Module/Build Setup**
   - Vite/ESBuild
   - pinned versions
3. **Automated sanity tests**
   - Matrix‑Tests (hand‑picked eye positions → expected l/r/t/b ranges)
   - screenshot regression (optional)
---
## 10) Quellen & Hintergründe

**Kernartikel (Implementierung/Geometrie)**
- [S1] Michel de Brisis (TRY Creative Tech): *Off-axis projection in Unity*  
  https://medium.com/try-creative-tech/off-axis-projection-in-unity-1572d826541e
- [S2] Paul Bourke (PDF): *Offaxis frustums / window model*  
  https://paulbourke.net/papers/HET409_2004/het409.pdf

**API-Referenzen**
- [S3] three.js Docs: `Matrix4.makePerspective(...)`  
  https://threejs.org/docs/pages/Matrix4.html
- [S4] MediaPipe / Google AI Edge: *Face Landmarker (Web/JS)* v0.10.8  
  https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js

**Hardware-/Ergonomie-Defaults**
- [S5] Apple Support: *MacBook Pro (16-inch, 2023) – Technical Specifications*  
  https://support.apple.com/en-us/111838
- [S6] OSHA eTool: *Computer Workstations – Monitors* (Richtwerte Betrachtungsabstand)  
  https://www.osha.gov/etools/computer-workstations/components/monitors

**Ursprung (Kooima)**
- [S7] Robert Kooima: *Generalized Perspective Projection* (wird im Unity-Artikel als Basis verlinkt)  
  https://160592857366.free.fr/joe/ebooks/ShareData/Generalized%20Perspective%20Projection.pdf

> Hinweis: Der Host von [S7] kann zeitweise langsam sein. Falls der Link nicht lädt, suche nach  
> „Robert Kooima Generalized Perspective Projection pdf“ und nutze ein Mirror/Archive.

## 11) Leitplanken (damit das Projekt nicht “abdriftet”)
**Nicht machen (Anti‑Patterns)**
- `camera.lookAt(...)` als “Fix” (zerstört das physikalische Modell)
- Parent‑Rotation / Scene‑Skalierung als Workaround
- Screen‑Plane skalieren ohne das Mapping mitzuziehen
**Immer machen**
- Jede Änderung an Tracking/Units zuerst mit Debug‑Frustum prüfen
- Screen‑Maße und Z‑Range in Metern denken
- Kalibrierung als first‑class Feature behandeln (weil ohne echte Depth‑Sensorik essenziell)
---
Wenn du möchtest, kann ich als nächsten Schritt:
- das Kalibrier‑UX “geführt” machen (Countdown + Mittelung + Speichern),
- oder das Projekt auf Vite umstellen (sauberer dev server + build).
