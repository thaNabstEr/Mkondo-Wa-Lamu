# The black mangrove (Bruguiera gymnorhiza) as a tree, the way Sakura makes its trees: a grown skeleton of limbs
# dressed with leaf sprays rendered from a CC0 scan (pipeline/lamu/bruguiera_sprays.py, through Sakura's atlas
# pipeline). Sakura grows its skeletons in the browser (src/world/trees.js); here the same idea runs in Blender, so the
# tree comes out as a model like the red mangrove and goes through the same tiers (pipeline/lamu/mangrove.py).
#
#   blender -b --python pipeline/lamu/bruguiera_tree.py -- <sprays-dir> <red-mangrove.glb> <out.glb>
#
# Form, from descriptions of the species: a straight trunk, buttressed at the foot, with knee roots looping up out of
# the mud around it (no stilt roots); a narrow, conical crown of tiered limbs; leaves crowded at the shoot tips. The
# atlas is the four spray cells (2 x 2, 1024 px each, 0.5 m across, the twig entering at the left edge halfway up),
# regraded a little deeper green. The bark is the red mangrove's own bark image (the scan has no bark).
import bpy, bmesh, sys, math, random
import numpy as np
import OpenImageIO as oiio
from mathutils import Vector, Matrix, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
SPRAYS, RED, OUT = argv[0], argv[1], argv[2]
R = random.Random(2311)
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------------------------------------------------------------- the spray atlas
CELL_M, BASE_U = 0.5, 0.02
def read(p):
    cfg = oiio.ImageSpec(); cfg.attribute('oiio:UnassociatedAlpha', 1)
    return oiio.ImageBuf(p, 0, 0, cfg).get_pixels(oiio.FLOAT)
atlas = np.zeros((2048, 2048, 4), dtype=np.float32)
for i in range(4):
    c = read(f'{SPRAYS}/c{i}.png')
    rgb = c[..., :3]
    # the scanned leaves are pale and mottled yellow: a little deeper and greener, as the living canopy reads
    lum = rgb.mean(axis=2, keepdims=True)
    rgb = np.clip((rgb * np.array([0.8, 0.94, 0.85]) * 0.82) * 0.85 + lum * np.array([0.16, 0.2, 0.12]), 0, 1)
    c[..., :3] = rgb
    r, q = divmod(i, 2)
    atlas[r * 1024:(r + 1) * 1024, q * 1024:(q + 1) * 1024] = c
spec = oiio.ImageSpec(2048, 2048, 4, oiio.UINT8); spec.attribute('oiio:UnassociatedAlpha', 1)
b = oiio.ImageBuf(spec); b.set_pixels(oiio.ROI(0, 2048, 0, 2048, 0, 1, 0, 4), np.ascontiguousarray(atlas))
ATLAS = f'{SPRAYS}/brug_sprays.png'
b.write(ATLAS)
def cell_uv(i, u, v):
    """atlas UV (Blender: v up) of point (u, v) of cell i (cell rows run top-down in the image)"""
    r, q = divmod(i, 2)
    return ((q + u) / 2, 1 - (r + 1 - v) / 2)

# ---------------------------------------------------------------- the red mangrove's bark image
# all of its materials share one atlas: the bark is the patch its bark faces map to, cut out so it can tile
bpy.ops.import_scene.gltf(filepath=RED)
src_img, us_, vs_ = None, [], []
for o in [o for o in bpy.data.objects if o.type == 'MESH']:
    me_ = o.data
    for poly in me_.polygons:
        m = me_.materials[poly.material_index]
        if 'Bark' not in m.name: continue
        if src_img is None:
            src_img = next(n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE').image
        for li in poly.loop_indices:
            uv = me_.uv_layers[0].data[li].uv; us_.append(uv.x); vs_.append(uv.y)
u0, u1 = np.percentile(us_, [2, 98]); v0, v1 = np.percentile(vs_, [2, 98])
iw, ih = src_img.size
px = np.array(src_img.pixels[:], dtype=np.float32).reshape(ih, iw, 4)
crop = px[int(v0 * ih):int(v1 * ih), int(u0 * iw):int(u1 * iw)].copy()
crop[..., 3] = 1
# the red mangrove's bark is pale and lichened: Bruguiera's is darker, grey-brown and rough
crop[..., :3] *= np.array([0.62, 0.55, 0.48])
bark_img = bpy.data.images.new('bruguiera_bark', crop.shape[1], crop.shape[0], alpha=False)
bark_img.pixels = crop.ravel()
bark_img.filepath_raw = f'{SPRAYS}/bark.png'; bark_img.file_format = 'PNG'; bark_img.save()
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
print('BARK', src_img.name, 'patch u', round(u0, 3), round(u1, 3), 'v', round(v0, 3), round(v1, 3), 'size', crop.shape[1], crop.shape[0])

def material(name, img, alpha):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
    nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    if alpha: nt.links.new(t.outputs['Alpha'], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 0.85 if not alpha else 0.6
    return m
bark = material('bark', bark_img, False)
leaf = material('leaf', bpy.data.images.load(ATLAS), True)

# ---------------------------------------------------------------- the skeleton: limbs as tubes
verts, faces, uvs, mats = [], [], [], []
SIDES = 7
def tube(pts, radii, tex_v0=0.0):
    """a tube through pts with the given radii; the bark patch is a strip that runs along its u, so u follows the
    limb (two metres a tile) and v goes once round"""
    n = len(pts)
    base = len(verts)
    v_along = tex_v0
    prev = None
    for i, (p, r) in enumerate(zip(pts, radii)):
        d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        side = (prev if prev is not None else (d.orthogonal())).normalized()
        side = (side - d * side.dot(d)).normalized()
        prev = side
        up = d.cross(side)
        if i: v_along += (pts[i] - pts[i - 1]).length / 1.0
        for k in range(SIDES + 1):
            a = 2 * math.pi * k / SIDES
            verts.append(p + (side * math.cos(a) + up * math.sin(a)) * r)
            uvs.append((v_along / 2.0, k / SIDES))
    for i in range(n - 1):
        for k in range(SIDES):
            a = base + i * (SIDES + 1) + k
            b_ = a + SIDES + 1
            faces.append((a, a + 1, b_ + 1, b_)); mats.append(0)

def curve(p0, d, length, steps, droop=0.0, wander=0.15):
    pts = [p0.copy()]
    d = d.normalized()
    for i in range(steps):
        d = (d + Vector((R.uniform(-wander, wander), R.uniform(-wander, wander), -droop))).normalized()
        pts.append(pts[-1] + d * (length / steps))
    return pts

tips = []  # (point, direction) where sprays go
def limb(p0, d, length, r0, depth):
    pts = curve(p0, d, length, max(3, int(length / 0.35)), droop=0.02 * depth, wander=0.1 + 0.05 * depth)
    radii = [r0 * (1 - 0.75 * i / (len(pts) - 1)) for i in range(len(pts))]
    tube(pts, radii)
    if depth >= 2 or length < 0.5:
        tips.append((pts[-1], (pts[-1] - pts[-2]).normalized()))
        # and a couple of shoots off the last stretch
        for j in (len(pts) - 2, len(pts) - 3):
            if j > 0:
                dd = ((pts[j] - pts[j - 1]).normalized() + Vector((R.uniform(-0.6, 0.6), R.uniform(-0.6, 0.6), R.uniform(0, 0.4)))).normalized()
                tips.append((pts[j], dd))
        return
    for j in range(1, len(pts)):
        if j == len(pts) - 1 or R.random() < 0.45:
            dj = (pts[j] - pts[j - 1]).normalized()
            spread = Vector((R.uniform(-1, 1), R.uniform(-1, 1), R.uniform(-0.1, 0.5)))
            nd = (dj + spread * 0.8).normalized()
            limb(pts[j], nd, length * R.uniform(0.45, 0.65), radii[j] * 0.7, depth + 1)

# trunk: straight, a little leaning, flared at the foot into low buttresses
H = R.uniform(8.0, 9.0)
lean = Vector((R.uniform(-0.04, 0.04), R.uniform(-0.04, 0.04), 1)).normalized()
trunk = [Vector((0, 0, -0.4))] + [lean * (H * 0.92 * i / 16) for i in range(1, 17)]
tr = [0.2 * (1 - 0.82 * i / 16) for i in range(17)]
tr[0] = tr[1] = 0.3
tube(trunk, tr)
for k in range(5):
    a = 2 * math.pi * (k + R.uniform(-0.2, 0.2)) / 5
    d = Vector((math.cos(a), math.sin(a), 0))
    tube([d * 0.05 + Vector((0, 0, 0.7)), d * 0.25 + Vector((0, 0, 0.25)), d * 0.5 + Vector((0, 0, -0.05))], [0.05, 0.07, 0.04])
# knee roots: low arches looping up out of the mud around the foot
for k in range(14):
    a = R.uniform(0, 2 * math.pi)
    r = R.uniform(0.6, 2.2)
    c = Vector((math.cos(a), math.sin(a), 0)) * r
    t = Vector((-math.sin(a), math.cos(a), 0)) * R.uniform(-0.3, 0.3) + Vector((math.cos(a), math.sin(a), 0))
    t.normalize()
    h = R.uniform(0.18, 0.4)
    pts = [c - t * 0.18 + Vector((0, 0, -0.1)), c - t * 0.1 + Vector((0, 0, h * 0.8)), c + Vector((0, 0, h)), c + t * 0.1 + Vector((0, 0, h * 0.8)), c + t * 0.18 + Vector((0, 0, -0.1))]
    tube(pts, [0.035, 0.04, 0.04, 0.04, 0.035])
# tiered limbs, longer low down: a narrow cone
z0 = H * R.uniform(0.3, 0.38)
n_lim = 15
for i in range(n_lim):
    t = i / (n_lim - 1)
    z = z0 + (H * 0.9 - z0) * t
    p = lean * z
    a = i * 2.4 + R.uniform(-0.3, 0.3)  # golden-angle phyllotaxis
    up = 0.25 + 0.5 * t
    d = Vector((math.cos(a), math.sin(a), up))
    L = (1 - t) * 1.9 + 0.7
    limb(p, d, L, 0.09 * (1 - 0.6 * t), 0)
# a leading shoot at the top
tips.append((lean * H * 0.95, Vector((0, 0, 1))))

# ---------------------------------------------------------------- the sprays on the shoot tips
SCALE = 1.45  # the cell is 0.5 m: leaves of about 18 cm, as large as Bruguiera's grow
W = CELL_M * SCALE
n_cards = 0
for p, d in tips:
    for k in range(4):
        dd = (d + Vector((R.uniform(-0.7, 0.7), R.uniform(-0.7, 0.7), R.uniform(-0.2, 0.5)))).normalized()
        # the spray's face is turned toward the sky and outward, rolled at random about its own length
        side = dd.cross(Vector((0, 0, 1)))
        if side.length < 0.1: side = Vector((1, 0, 0))
        side = Quaternion(dd, R.uniform(-0.9, 0.9)) @ side.normalized()
        cell = 3 if R.random() < 0.18 else R.randrange(3)
        corners = [(BASE_U, 0), (1, 0), (1, 1), (BASE_U, 1)]
        base = len(verts)
        for u, v in corners:
            verts.append(p + dd * ((u - BASE_U) * W) + side * ((v - 0.5) * W))
            uvs.append(cell_uv(cell, u, v))
        faces.append((base, base + 1, base + 2, base + 3)); mats.append(1)
        n_cards += 1

me = bpy.data.meshes.new('bruguiera')
me.from_pydata(verts, [], faces)
uvl = me.uv_layers.new(name='UVMap')
for poly, mi in zip(me.polygons, mats):
    poly.material_index = mi
    for li in poly.loop_indices:
        uvl.data[li].uv = uvs[me.loops[li].vertex_index]
me.materials.append(bark); me.materials.append(leaf)
for poly in me.polygons: poly.use_smooth = poly.material_index == 0
ob = bpy.data.objects.new('bruguiera', me)
bpy.context.scene.collection.objects.link(ob)
# split by material: the tiering step reads one material per mesh
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
me.calc_loop_triangles()
print('TREE height', round(H, 2), 'tips', len(tips), 'cards', n_cards, 'tris', sum(len(o.data.polygons) * 2 for o in bpy.data.objects if o.type == 'MESH'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                          export_image_format='AUTO')
