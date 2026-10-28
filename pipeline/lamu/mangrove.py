# A downloaded mangrove tree, made ready for a forest of thousands. Nothing is remodelled: the tree is scaled to a
# real size and stood on its own origin, its leaf materials become cut-outs, and it is thinned into lighter versions
# for distance:
#   lod0  near  a share of the leaf cards (each enlarged by the inverse square root of the share, so the crown keeps
#               its coverage), the wood decimated
#   lod1  mid   fewer, larger cards, the wood decimated harder
#   lod2  far   three crossed cards carrying renders of the tree from three sides (also what the water reflects)
#
#   blender -b --python pipeline/lamu/mangrove.py -- <spec> <src.glb> <out-dir>
# spec: red   red-mangrove-tree_single_2.glb ("red-mangrove-tree", SAVIA_Colombia, CC BY 4.0): all three tiers
#       light mangrove_tree_single.glb ("Mangrove Tree", Nice2meetU2, CC BY 4.0): the far cards only, as filler
#       rhizo Main_mangroove_forest.glb (ffish.asia / floraZia, CC0): a field scan of a red mangrove (Rhizophora
#             mucronata) clump, crown and stilt roots on its patch of mud. Its foliage is melted into lumps, as
#             photogrammetry makes of leaves, so it is only ever seen far off: the far cards only, for the forest mass
#       brug  .cache/build/bruguiera_src.glb, the black mangrove grown by bruguiera_tree.py from the CC0 Bruguiera
#             gymnorhiza leaf scan through the atlas pipeline: all three tiers
#
# Frame: game y-up; in Blender z-up. The tree stands on its model origin (where its roots meet the ground); the
# game plants that origin at the bed or bank and lets the roots below it run into the mud and water.
import bpy, bmesh, sys, math, random
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
SPEC, SRC, OUT = args[0], args[1], args[2]

SPECS = {
    # crown top 7.4 m above the root plane: the arching stilt roots stand about 2.6 m above it, as in the owner's
    # photographs (a wall of roots 1.5-3 m high under a canopy 6-10 m up)
    'red': {
        'top': 7.4,
        'mats': {'RedMangroveBark_Mat': 'bark', 'RedMangroveBranch_Mat': 'twig', 'RedMangroveLeaf_Mat': 'leaf',
                 'RedMangrovePod_Mat': 'pod', 'Cap_03_Mat': 'cap'},
        # cut-out cards (leaves, twig sprays, the hanging propagules): thinned by dropping parts, not decimated
        'cards': {'leaf', 'twig', 'pod'},
        # the "cap" draws nothing (its texture is clear where its faces map) but costs 9,000 triangles
        'drop': {'cap'},
        # per material: (share of loose parts kept, decimation ratio) for lod0 and lod1
        'lod0': {'leaf': (0.12, 1), 'twig': (0.25, 1), 'pod': (0.15, 0.4), 'bark': (1, 0.035)},
        'lod1': {'leaf': (0.03, 1), 'twig': (0.08, 1), 'pod': (0.04, 0.3), 'bark': (1, 0.01)},
        # the stilt roots (the wood below this height) are what the follow camera sees along the bank: decimated
        # far less than the trunk and limbs above them, so the root wall still reads in the mid tier
        'roots': {'z': 2.8, 'lod0': 0.08, 'lod1': 0.045},
        # (in linear light, as mangroves.js sets it on the near trees' bark)
        'bark_tint': (0.5, 0.41, 0.33),
        'tiers': ['lod0', 'lod1', 'lod2'],
    },
    # crown top 6.5 m: a smaller tree for the ranks behind; its mud disc is left off the cards
    'light': {
        'top': 6.5,
        'mats': {'T_Mangrove_Bark': 'bark', 'T_Mangrove_Leaves': 'leaf', 'material': 'base'},
        'cards': {'leaf'},
        'drop': {'base'},
        # its leaf texture is a JPEG with no alpha: the leaves are green on a yellow-olive and brown ground, so the
        # cut-out is keyed from the colour (green clearly above red)
        'key': {'leaf'},
        'bark_tint': (0.55, 0.46, 0.37),
        'tiers': ['lod2'],
    },
    # crown top 7 m above the mud it was scanned on: the ground under the clump is found (the lowest few percent of
    # the scan) and its up-facing mud cut away, so the cards stand on the roots, not on a slab
    'rhizo': {
        'top': 7.0,
        'mats': {'Material0': 'bark'},
        'cards': set(),
        'drop': set(),
        'ground': True,
        # its top view has grey lumps where the photogrammetry melted leaves into the sky behind them: greened
        'green_grey': 0.8,
        'tiers': ['lod2'],
    },
    # crown top 8.5 m: Bruguiera stands a little taller than the red mangroves, behind them
    'brug': {
        'top': 8.5,
        'mats': {},
        'cards': {'leaf'},
        'drop': set(),
        'lod0': {'leaf': (0.6, 1), 'bark': (1, 0.6)},
        'lod1': {'leaf': (0.16, 1), 'bark': (1, 0.15)},
        'tiers': ['lod0', 'lod1', 'lod2'],
    },
}
S = SPECS[SPEC]
random.seed(7)

# ---------------------------------------------------------------- load, bake, scale onto the root plane
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in meshes:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
for o in [o for o in bpy.data.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o)
for o in meshes:
    o.data.transform(o.matrix_world); o.matrix_world = Matrix.Identity(4)
import numpy as np
pts = [v.co for o in meshes for v in o.data.vertices]
cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
ground, top = 0.0, max(p.z for p in pts)
if S.get('ground'):
    # a field scan: no origin on the root plane. The ground is the low few percent of the surface; the top ignores
    # the odd stray spike above the crown
    zs = np.array([p.z for p in pts])
    ground, top = float(np.percentile(zs, 3)), float(np.percentile(zs, 99.8))
k = S['top'] / (top - ground)
M = Matrix.Scale(k, 4) @ Matrix.Translation((-cx, -cy, -ground))
for o in meshes:
    o.data.transform(M); o.data.update()
if S.get('ground'):
    # the mud it stood on: faces low down and facing up
    for o in meshes:
        bm = bmesh.new(); bm.from_mesh(o.data)
        dead = [f for f in bm.faces if f.calc_center_median().z < 0.35 and f.normal.z > 0.55]
        bmesh.ops.delete(bm, geom=dead, context='FACES')
        bm.to_mesh(o.data); bm.free()
    print(f'GROUND at {ground:.2f} source units; mud faces below 0.35 m cut away')
for m in bpy.data.materials:
    if m.name in S['mats']:
        m.name = S['mats'][m.name]
# keyed cut-outs: alpha from how much greener than red a pixel is
for m in bpy.data.materials:
    if m.name not in S.get('key', ()) or not m.use_nodes: continue
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    im = bsdf.inputs['Base Color'].links[0].from_node.image
    px = np.array(im.pixels[:], dtype=np.float32).reshape(-1, 4)
    g_r = px[:, 1] - px[:, 0]
    px[:, 3] = np.clip((g_r - 0.04) / 0.06, 0, 1)
    keyed = bpy.data.images.new(im.name + '_keyed', im.size[0], im.size[1], alpha=True)
    keyed.pixels = px.ravel()
    keyed.filepath_raw = f'{OUT}/{im.name}_keyed.png'; keyed.file_format = 'PNG'; keyed.save()
    bsdf.inputs['Base Color'].links[0].from_node.image = keyed
    print(f'KEYED {m.name}: {float((px[:, 3] > 0.5).mean()) * 100:.1f}% of the texture kept')

# every cut-out material takes its alpha from its colour texture, wired or not (the light tree's leaves were set
# opaque, so they drew as solid squares); the exporter then keeps the alpha, and pack-mangrove.mjs makes it a mask
for m in bpy.data.materials:
    if m.name not in S['cards'] or not m.use_nodes: continue
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    if bsdf and not bsdf.inputs['Alpha'].is_linked and bsdf.inputs['Base Color'].is_linked:
        src = bsdf.inputs['Base Color'].links[0].from_node
        if src.type == 'TEX_IMAGE': m.node_tree.links.new(src.outputs['Alpha'], bsdf.inputs['Alpha'])
for o in list(meshes):
    if o.data.materials[0].name in S['drop']:
        bpy.data.objects.remove(o); meshes.remove(o)
lo = Vector((min(v.co.x for o in meshes for v in o.data.vertices), min(v.co.y for o in meshes for v in o.data.vertices), min(v.co.z for o in meshes for v in o.data.vertices)))
hi = Vector((max(v.co.x for o in meshes for v in o.data.vertices), max(v.co.y for o in meshes for v in o.data.vertices), max(v.co.z for o in meshes for v in o.data.vertices)))
print(f'SIZE scale {k:.6f} bounds {tuple(round(v, 2) for v in lo)} .. {tuple(round(v, 2) for v in hi)}')

# ---------------------------------------------------------------- thinning
def loose_parts(bm):
    seen, parts = set(), []
    for f in bm.faces:
        if f.index in seen: continue
        stack, part = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop(); part.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen: seen.add(h.index); stack.append(h)
        parts.append(part)
    return parts

def thin(o, keep, ratio, card):
    """keep a share of the loose parts (cards are enlarged about their own centres to hold the coverage), then
    decimate"""
    if keep < 0.999:
        bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table()
        dead, grow = [], 1 / math.sqrt(keep) if card else 1
        for part in loose_parts(bm):
            if random.random() > keep:
                dead.extend(part); continue
            if grow != 1:
                vs = {v for f in part for v in f.verts}
                c = sum((v.co for v in vs), Vector()) / len(vs)
                for v in vs: v.co = c + (v.co - c) * grow
        bmesh.ops.delete(bm, geom=dead, context='FACES')
        bm.to_mesh(o.data); bm.free()
    if ratio < 0.999 and len(o.data.polygons):
        mod = o.modifiers.new('dec', 'DECIMATE'); mod.ratio = ratio; mod.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)

def tris(objs):
    n = 0
    for o in objs:
        o.data.calc_loop_triangles(); n += len(o.data.loop_triangles)
    return n

def export(objs, name, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    j.name = name; j.data.name = name
    bpy.ops.object.select_all(action='DESELECT'); j.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_image_format='AUTO')
    return j

def split_low(o, z):
    """the faces of o below height z, moved into a new object"""
    low = o.copy(); low.data = o.data.copy()
    bpy.context.scene.collection.objects.link(low)
    for ob, keep_low in ((o, False), (low, True)):
        bm = bmesh.new(); bm.from_mesh(ob.data)
        dead = [f for f in bm.faces if (f.calc_center_median().z < z) != keep_low]
        bmesh.ops.delete(bm, geom=dead, context='FACES')
        bm.to_mesh(ob.data); bm.free()
    return low

def mesh_tier(tier):
    copies = []
    for o in meshes:
        c = o.copy(); c.data = o.data.copy()
        bpy.context.scene.collection.objects.link(c)
        mat = o.data.materials[0].name
        keep, ratio = S[tier].get(mat, (1, 1))
        parts = [(c, ratio)]
        if mat == 'bark' and 'roots' in S:
            parts.append((split_low(c, S['roots']['z']), S['roots'][tier]))
        for part, r in parts:
            thin(part, keep, r, mat in S['cards'])
            if len(part.data.polygons): copies.append(part)
            else: bpy.data.objects.remove(part)
    n = tris(copies)
    j = export(copies, tier, f'{OUT}/mangrove_{SPEC}_{tier}.glb')
    bpy.data.objects.remove(j)
    print(f'TIER {SPEC} {tier} tris {n}')

for tier in [t for t in S['tiers'] if t != 'lod2']:
    mesh_tier(tier)

# ---------------------------------------------------------------- far cards: the tree rendered from four sides
# Three vertical quads through the trunk, turned 0, 60 and 120 degrees, each carrying an orthographic render of the
# full tree seen square-on to it, and a horizontal quad high in the crown carrying the canopy seen from above (the
# game fades between them by how steeply the camera looks down, so an aerial view sees a canopy, not crossed
# boards). Colour unlit (the albedo, so the game lights it) with the cut-out alpha.
W = max(hi.x - lo.x, hi.y - lo.y) * 1.02
Z0, Z1 = max(lo.z, -1.2), hi.z * 1.01
RES_W, RES_H = 512, int(512 * (Z1 - Z0) / W)
RES_H += RES_H % 2
cuts = []
for m in bpy.data.materials:
    if not m.use_nodes: continue
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    if not bsdf: continue
    col = bsdf.inputs['Base Color'].links[0].from_socket if bsdf.inputs['Base Color'].is_linked else None
    alpha = bsdf.inputs['Alpha'].links[0].from_socket if bsdf.inputs['Alpha'].is_linked else None
    em = nt.nodes.new('ShaderNodeEmission')
    if col and m.name == 'bark' and 'bark_tint' in S:
        # the bark as the game tints it on the near trees (mangroves.js), so the far cards' roots match theirs
        mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'
        mul.inputs['Factor'].default_value = 1.0
        nt.links.new(col, mul.inputs['A']); mul.inputs['B'].default_value = (*S['bark_tint'], 1)
        nt.links.new(mul.outputs['Result'], em.inputs['Color'])
    elif col: nt.links.new(col, em.inputs['Color'])
    else: em.inputs['Color'].default_value = bsdf.inputs['Base Color'].default_value
    out = nt.nodes['Material Output']
    if m.name in S['cards']:
        tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mix = nt.nodes.new('ShaderNodeMixShader')
        # the cut-out at half alpha, as the game draws it
        gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.5
        cuts.append(gt)
        nt.links.new(alpha if alpha is not None else col, gt.inputs[0])
        nt.links.new(gt.outputs[0], mix.inputs['Fac']); nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(em.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs['Surface'])
    else:
        nt.links.new(em.outputs[0], out.inputs['Surface'])
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x, sc.render.resolution_y = RES_W, RES_H
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = max(W, Z1 - Z0); cam.data.clip_end = 100
if RES_W >= RES_H: pass
cam.data.sensor_fit = 'VERTICAL' if (Z1 - Z0) > W else 'HORIZONTAL'
ANG = [0, 60, 120]
files = []
for a in ANG:
    t = math.radians(a)
    d = Vector((math.sin(t), -math.cos(t), 0))  # looking along -d at the card's face
    cam.location = Vector((0, 0, (Z0 + Z1) / 2)) + d * 30
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    f = f'{OUT}/mangrove_{SPEC}_card{a}.png'
    sc.render.filepath = f
    bpy.ops.render.render(write_still=True)
    files.append(f)
# the canopy from above, square, into the top of the fourth panel
TS = min(RES_W, RES_H)  # the square top view, as large as the panel allows
sc.render.resolution_x = sc.render.resolution_y = TS
cam.data.ortho_scale = W; cam.data.sensor_fit = 'AUTO'
cam.location = Vector((0, 0, Z1 + 20)); cam.rotation_euler = (0, 0, 0)
TOP_FILE = f'{OUT}/mangrove_{SPEC}_cardtop.png'
sc.render.filepath = TOP_FILE
# from above the canopy is drawn soft-edged: the leaves' own alpha, not the half-way cut, so a crown's rim thins out
# into its neighbours instead of ending in a hard star
for gt in cuts:
    gt.operation = 'MAXIMUM'; gt.inputs[1].default_value = 0.0
bpy.ops.render.render(write_still=True)

# the three renders side by side in one texture; the cards' quads map into their thirds
PANELS = 4
TOP_V, TOP_U = TS / RES_H, TS / RES_W  # the share of the fourth panel the square top view fills (from its top left)
atlas = bpy.data.images.new(f'mangrove_{SPEC}_cards', RES_W * PANELS, RES_H, alpha=True)
import numpy as np
px = np.zeros((RES_H, RES_W * PANELS, 4), dtype=np.float32)
for i, f in enumerate(files):
    im = bpy.data.images.load(f)
    a = np.array(im.pixels[:], dtype=np.float32).reshape(RES_H, RES_W, 4)
    px[:, i * RES_W:(i + 1) * RES_W] = a
top = np.array(bpy.data.images.load(TOP_FILE).pixels[:], dtype=np.float32).reshape(TS, TS, 4)
# a soft rim: the crown's colour bled out past its edge, then the top view's alpha blurred a few pixels
def box(a, r):
    for ax in (0, 1):
        c = np.cumsum(np.pad(a, [(r + 1, r) if i == ax else (0, 0) for i in range(2)], mode='edge'), axis=ax)
        a = (np.take(c, range(2 * r + 1, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - 2 * r - 1), axis=ax)) / (2 * r + 1)
    return a
# a crown from above is its leaves massed round the branches, not a star of them: the gaps between the limbs are
# closed (a dilation then an erosion of the alpha, about a fortieth of the view across), then the rim is softened
def grow(a, r):
    for _ in range(r):
        b = a.copy()
        b[1:] = np.maximum(b[1:], a[:-1]); b[:-1] = np.maximum(b[:-1], a[1:])
        b[:, 1:] = np.maximum(b[:, 1:], a[:, :-1]); b[:, :-1] = np.maximum(b[:, :-1], a[:, 1:])
        a = b
    return a
R_CLOSE = max(3, TS // 40)
a_ = top[..., 3]
a_ = np.maximum(a_, 1 - grow(1 - grow(a_, R_CLOSE), R_CLOSE))
fill = np.stack([box(top[..., i] * a_, 8) for i in range(3)], axis=-1) / np.maximum(box(a_, 8), 1e-4)[..., None]
top[..., :3] = np.where(top[..., 3:4] < 0.5, fill, top[..., :3])
# seen from above the crown's shaded depths show between its sunlit leaves: the unlit albedo of the top view is
# toned down a little to sit with the lit geometry beside it
top[..., :3] *= 0.85
top[..., 3] = box(a_, 3)
px[RES_H - TS:, 3 * RES_W:3 * RES_W + TS] = top  # Blender's pixel rows run bottom-up: the top of the panel is the last rows
if S.get('green_grey'):
    # the scan's grey lumps (where photogrammetry melted leaves into the sky behind them) greened, in every view
    rgb = px[..., :3]
    lum = rgb.mean(axis=2, keepdims=True)
    sat = rgb.max(axis=2, keepdims=True) - rgb.min(axis=2, keepdims=True)
    grey = np.clip(1 - sat / np.maximum(lum, 1e-3) / 0.35, 0, 1) * np.clip((lum - 0.12) / 0.2, 0, 1) * S['green_grey']
    px[..., :3] = rgb * (1 - grey) + lum * np.array([0.6, 0.85, 0.42]) * grey
atlas.pixels = px.ravel()
atlas.filepath_raw = f'{OUT}/mangrove_{SPEC}_cards.png'; atlas.file_format = 'PNG'; atlas.save()

# Each card is two faces back to back, so both sides light the same way; the vertex normals round off over the
# crown (outward and up from the trunk), so the flat cards take the light like a canopy rather than like boards.
me = bpy.data.meshes.new('lod2')
verts, faces, uvs, nrms = [], [], [], []
mid = (Z0 + Z1) / 2
def crown_normal(p):
    return Vector((p[0] / (W / 2) * 0.55, p[1] / (W / 2) * 0.55, (p[2] - mid) / ((Z1 - Z0) / 2) * 0.35 + 0.65)).normalized()
for i, a in enumerate(ANG):
    t = math.radians(a)
    r = Vector((math.cos(t), math.sin(t), 0)) * (W / 2)  # the card's right, seen from its face
    quad = [(-r.x, -r.y, Z0), (r.x, r.y, Z0), (r.x, r.y, Z1), (-r.x, -r.y, Z1)]
    quv = [(i / PANELS, 0), ((i + 1) / PANELS, 0), ((i + 1) / PANELS, 1), (i / PANELS, 1)]
    for back in (False, True):
        base = len(verts)
        verts += quad; uvs += quv; nrms += [crown_normal(p) for p in quad]
        faces.append((base, base + 3, base + 2, base + 1) if back else (base, base + 1, base + 2, base + 3))
# the top card, high in the crown, facing up and down; image up (+v) is the render's up, which looked down -Z with
# +Y up the frame. It is a quarter larger than the crown, so neighbouring crowns overlap from above
TOP_GROW = 1.25
ZT = Z0 + (Z1 - Z0) * 0.8
h = W / 2 * TOP_GROW
tquad = [(-h, -h, ZT), (h, -h, ZT), (h, h, ZT), (-h, h, ZT)]
u1 = (3 + TOP_U) / PANELS
tuv = [(3 / PANELS, 1 - TOP_V), (u1, 1 - TOP_V), (u1, 1), (3 / PANELS, 1)]
for down in (False, True):
    base = len(verts)
    verts += tquad; uvs += tuv; nrms += [Vector((0, 0, -1 if down else 1))] * 4
    faces.append((base, base + 3, base + 2, base + 1) if down else (base, base + 1, base + 2, base + 3))
me.from_pydata(verts, [], faces)
uvl = me.uv_layers.new(name='UVMap')
for p in me.polygons:
    for li in p.loop_indices: uvl.data[li].uv = uvs[me.loops[li].vertex_index]
me.normals_split_custom_set_from_vertices(nrms)
mat = bpy.data.materials.new('cards'); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = atlas
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color']); nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
me.materials.append(mat)
ob = bpy.data.objects.new('lod2', me); sc.collection.objects.link(ob)
for o in meshes: o.hide_set(True); o.select_set(False)
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=f'{OUT}/mangrove_{SPEC}_lod2.glb', export_format='GLB', use_selection=True,
                          export_yup=True, export_apply=True, export_image_format='AUTO')
print(f'TIER {SPEC} lod2 tris 16 cards {RES_W * PANELS}x{RES_H} height {Z1 - Z0:.2f} width {W:.2f}')
