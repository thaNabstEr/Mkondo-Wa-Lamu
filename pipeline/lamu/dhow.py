# The player's dhow, from the downloaded model (Context/3D Assets/dhow_ver_1.glb, "Dhow" by gogiart, CC BY 4.0).
# Nothing is remodelled: the model is turned into the game's frame and scaled, its parts are named, two original
# decorations are fitted onto its surfaces (the Lamu eye on the sail, the painted bow board on both bows), one
# fitting is added (the model has no tiller: a rudder head and tiller on the rudder), and it is decimated into two
# tiers. The full-detail hull is measured for the water shader and for placing the crew.
#
#   blender -b --python pipeline/lamu/dhow.py -- <src.glb> <out-dir> <hull.js>
#
# Frame: the game is y-up with the bow toward +z and the waterline at y = 0; in Blender (z-up) that is the bow
# toward -Y and the waterline at Z = 0 (the glTF exporter turns Blender's -Y into the game's +z).
# Scale: no source gives a mashua's length, so the model is sized against Sakura's boatman (1.52 m as he stands to
# scull): at x1.1 it is 6.6 m long with a 2.0 m beam, the rail 0.94 m above the floor, at his hip.
import bpy, bmesh, sys, json, math
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT, HULL_JS = args[0], args[1], args[2]
BUILD = OUT  # the generated textures (pipeline/lamu/textures.mjs) are read from here too

SCALE = 1.1
WL = -1.85  # model units: just below the painted topsides, where the planking turns pale

# what each source part is (seen in renders of each part alone) and its material
ROLE = {
    'Object_2': 'sail', 'Object_3': 'sail',
    'Object_4': 'hull', 'Object_5': 'hull', 'Object_6': 'rudder', 'Object_7': 'hull', 'Object_8': 'hull',
    'Object_9': 'hull', 'Object_10': 'hull', 'Object_11': 'hull', 'Object_12': 'hull', 'Object_13': 'hull',
    'Object_14': 'hull', 'Object_15': 'hull', 'Object_16': 'hull',
    'helm': 'rudder',
}
MAT = {'acmat_0': 'rudder_iron', 'acmat_1': 'wood', 'acmat_2': 'rope', 'acmat_3': 'iron', 'acmat_4': 'pins',
       'acmat_5': 'sail_rings', 'acmat_6': 'spars', 'acmat_7': 'sail', 'acmat_8': 'hull_paint'}
# the parts whose outer surface is the hull's skin: measured, and the bow board is laid on them
SKIN = ['Object_4', 'Object_7']
# the parts that make the floor and decks (for where the boatman sits and puts his feet)
DECKS = ['Object_4', 'Object_7', 'Object_8', 'Object_9']

# decimation per part: the quick tier (about 60k triangles all told) and the full tier (about three times that).
# Planking, ropes and iron fittings carry far more triangles than their shapes need.
LO = {'Object_7': 0.11, 'Object_8': 0.11, 'Object_9': 0.14, 'Object_4': 0.18, 'Object_12': 0.08, 'Object_14': 0.04,
      'Object_15': 0.07, 'Object_2': 0.25, 'Object_5': 0.15, 'Object_6': 0.15, 'Object_16': 0.5}
HI = {k: min(1.0, v * 3) for k, v in LO.items()}

# ---------------------------------------------------------------- load, bake into world space, turn and scale
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in meshes:
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
for o in [o for o in bpy.data.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o)
for o in meshes:
    o.data.transform(o.matrix_world)
    o.matrix_world = Matrix.Identity(4)

def bounds(objs):
    pts = [v.co for o in objs for v in o.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi

lo, hi = bounds([bpy.data.objects[n] for n in SKIN])
cx = (lo.x + hi.x) / 2
M = Matrix.Scale(SCALE, 4) @ Matrix.Rotation(math.radians(90), 4, 'Z') @ Matrix.Translation((-cx, 0, -WL))
for o in meshes:
    o.data.transform(M)
    o.data.update()
for m in bpy.data.materials:
    if m.name in MAT:
        m.name = MAT[m.name]

def bvh(names):
    bm = bmesh.new()
    for n in names:
        bm.from_mesh(bpy.data.objects[n].data)
    t = BVHTree.FromBMesh(bm)
    bm.free()
    return t

# ---------------------------------------------------------------- the decks' smeared strips
# Along the floor's centre line, where it steps up toward the stern, the source maps some strips of planking with UVs
# collapsed in one direction, so the plank texture smears into streaks. Those faces (the weaker of their two UV
# directions collapsed to under a fifth of the part's usual; the planks are mapped with some stretch everywhere, by
# design) are found, gathered into connected islands, and each island is given a flat projection on its own plane: the part's
# usual texel density, the grain running the way the well-mapped planks run, centred where the island already sat in
# the texture. UVs only; the geometry is untouched.
def fix_smears(o):
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    uvl = bm.loops.layers.uv.active
    bm.faces.ensure_lookup_table()
    J, bad = {}, set()
    for f in bm.faces:
        ls = f.loops
        if len(ls) < 3 or f.calc_area() < 1e-10: continue
        p0, p1, p2 = ls[0].vert.co, ls[1].vert.co, ls[2].vert.co
        t0, t1, t2 = ls[0][uvl].uv, ls[1][uvl].uv, ls[2][uvl].uv
        n = f.normal
        ax = (p1 - p0).normalized(); bx = n.cross(ax)
        P = np.array([[(p1 - p0).dot(ax), (p2 - p0).dot(ax)], [(p1 - p0).dot(bx), (p2 - p0).dot(bx)]])
        T = np.array([[t1.x - t0.x, t2.x - t0.x], [t1.y - t0.y, t2.y - t0.y]])
        if abs(np.linalg.det(P)) < 1e-12: continue
        M = T @ np.linalg.inv(P)
        sv = np.linalg.svd(M, compute_uv=False)
        J[f.index] = (M, ax, bx, sv)
    weak = float(np.median([sv[1] for _, _, _, sv in J.values()]))
    bad = {i for i, (_, _, _, sv) in J.items() if sv[1] < 0.2 * weak}
    good = [J[i] for i in J if i not in bad]
    if not good or not bad:
        bm.free(); return 0
    k = float(np.median([np.sqrt(sv[0] * sv[1]) for _, _, _, sv in good]))
    # the grain: where the boat's length (Blender Y) goes in UV on the well-mapped faces
    gs = []
    for M, ax, bx, sv in good:
        y = Vector((0, 1, 0)); loc = np.array([y.dot(ax), y.dot(bx)])
        if np.linalg.norm(loc) < 0.5: continue
        g = M @ loc
        if np.linalg.norm(g) > 1e-9: g = g / np.linalg.norm(g); gs.append(g if g[0] + g[1] >= 0 else -g)
    g = np.mean(gs, axis=0); g /= np.linalg.norm(g); gp = np.array([-g[1], g[0]])
    seen, islands = set(), 0
    for i in bad:
        if i in seen: continue
        stack, isl = [bm.faces[i]], []
        seen.add(i)
        while stack:
            f = stack.pop(); isl.append(f)
            for e in f.edges:
                for h in e.link_faces:
                    if h.index in bad and h.index not in seen: seen.add(h.index); stack.append(h)
        N = sum((f.normal for f in isl), Vector()).normalized()
        along = Vector((0, 1, 0)) - N * N.y
        if along.length < 0.2: along = Vector((1, 0, 0)) - N * N.x
        along.normalize(); across = N.cross(along)
        c = sum((l.vert.co for f in isl for l in f.loops), Vector()) / sum(len(f.loops) for f in isl)
        cu = sum((l[uvl].uv for f in isl for l in f.loops), Vector((0, 0))) / sum(len(f.loops) for f in isl)
        for f in isl:
            for l in f.loops:
                d = l.vert.co - c
                uv = np.array([cu.x, cu.y]) + k * (d.dot(along) * g + d.dot(across) * gp)
                l[uvl].uv = (float(uv[0]), float(uv[1]))
        islands += 1
    bm.to_mesh(me); bm.free()
    print(f'SMEARS {o.name}: {len(bad)} stretched faces in {islands} islands re-projected (density {k:.3f}/m)')
    return len(bad)

for n in ['Object_7', 'Object_8', 'Object_9']:  # the floor and decks (not the painted skin)
    fix_smears(bpy.data.objects[n])

skin = bvh(SKIN)
decks = bvh(DECKS)
# game frame <-> Blender frame: game (x, y, z) = Blender (X, Z, -Y)
G = lambda p: [round(p.x, 4), round(p.z, 4), round(-p.y, 4)]

# ---------------------------------------------------------------- measure the hull at the waterline
def half_width(Y, Z):
    hits = []
    for s in (1, -1):
        h = skin.ray_cast(Vector((s * 4, Y, Z)), Vector((-s, 0, 0)))
        if h[0] is not None:
            hits.append(abs(h[0].x))
    return sum(hits) / len(hits) if hits else 0.0

ys = [k / 200 for k in range(-900, 901)]
wet = [Y for Y in ys if half_width(Y, 0.0) > 0.02]
y_bow, y_stern = min(wet), max(wet)  # Blender Y: the bow is toward -Y
z0 = -y_stern  # game z of the transom at the waterline
length = y_stern - y_bow
WLW = [round(half_width(y_stern - i / 35 * length, 0.0), 3) for i in range(36)]
lo_all, hi_all = bounds([o for o in meshes if ROLE[o.name] != 'sail'])

# the floor and decks along the centre line, for placing the crew
def deck_y(Y):
    h = decks.ray_cast(Vector((0, Y, 4)), Vector((0, 0, -1)))
    return h[0].z if h[0] is not None else None
profile = [(round(-Y, 3), round(deck_y(Y), 3)) for Y in [y / 20 for y in range(-70, 71)] if deck_y(Y) is not None]

# ---------------------------------------------------------------- the bow board, both sides
def sheer(Y, s):
    # the hull side's top edge at this station: step down from above until the side is hit
    for k in range(0, 200):
        Z = 2.2 - k * 0.01
        h = skin.ray_cast(Vector((s * 4, Y, Z)), Vector((-s, 0, 0)))
        if h[0] is not None:
            return Z
    return None

def grid_mesh(name, verts, uvs, nu, nv, outward, mat):
    me = bpy.data.meshes.new(name)
    faces = []
    for j in range(nv):
        for i in range(nu):
            a, b, c, d = j * (nu + 1) + i, j * (nu + 1) + i + 1, (j + 1) * (nu + 1) + i + 1, (j + 1) * (nu + 1) + i
            if None in (verts[a], verts[b], verts[c], verts[d]):
                continue
            n = (verts[b] - verts[a]).cross(verts[d] - verts[a])
            faces.append((a, b, c, d) if n.dot(outward(verts[a])) > 0 else (a, d, c, b))
    me.from_pydata([v if v is not None else Vector() for v in verts], [], faces)
    uvl = me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        for li in p.loop_indices:
            uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob

def image_material(name, path, alpha=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(path)
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if alpha:
        nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 0.6
    return m

board_mat = image_material('bowboard', BUILD + '/bowboard.png')
BOARD_LEN, BOARD_H, NU, NV = 1.7, 0.42, 48, 8
decor = []
for s in (1, -1):
    # the stem: the furthest-forward station where the side still stands at full height
    y_stem = min(Y for Y in [y / 100 for y in range(-400, 0)] if sheer(Y, s) is not None)
    # the side's top edge steps where the rail meets the planking: a smooth curve through it keeps the board's
    # edges fair
    st = [(y_stem + 0.06 + i / NU * BOARD_LEN) for i in range(NU + 1)]
    sh = [(Y, sheer(Y, s)) for Y in st]
    sh = [(Y, z) for Y, z in sh if z is not None]
    fit = np.polyfit([q[0] for q in sh], [q[1] for q in sh], 2)
    verts, uvs = [], []
    for j in range(NV + 1):
        for i in range(NU + 1):
            u, v = i / NU, j / NV
            Y = st[i]
            top = float(np.polyval(fit, Y))
            Z = top - 0.02 - v * BOARD_H
            h = skin.ray_cast(Vector((s * 4, Y, Z)), Vector((-s, 0, 0)))
            if h[0] is None:
                verts.append(None)
            else:
                n = h[1] if h[1].x * s > 0 else -h[1]
                verts.append(h[0] + n * 0.006)
            uvs.append((u, 1 - v))
    decor.append(grid_mesh(f'bowboard_{"s" if s > 0 else "p"}', verts, uvs, NU, NV, lambda p, s=s: Vector((s, 0, 0)), board_mat))

# ---------------------------------------------------------------- the Lamu eye on the sail, both faces
sail_obj = bpy.data.objects['Object_3']
sail_tree = bvh(['Object_3'])
pts = [v.co for v in sail_obj.data.vertices]
c = sum(pts, Vector()) / len(pts)
# the sail's plane: its normal is the direction of least spread
P = np.array([[p.x - c.x, p.y - c.y, p.z - c.z] for p in pts])
w, V = np.linalg.eigh(P.T @ P)
nrm = Vector(V[:, 0]).normalized()
up = (Vector((0, 0, 1)) - nrm * nrm.z).normalized()
side = up.cross(nrm).normalized()
# the eye sits at the sail's area centroid, a third of its height across
area, cen = 0.0, Vector()
for f in sail_obj.data.polygons:
    area += f.area; cen += f.center * f.area
cen /= area
span = max((p - cen).dot(up) for p in pts) - min((p - cen).dot(up) for p in pts)
D = 0.36 * span
eye_mat = image_material('emblem', BUILD + '/emblem.png', alpha=True)
N = 28
for face in (1, -1):
    verts, uvs = [], []
    for j in range(N + 1):
        for i in range(N + 1):
            u, v = i / N, j / N
            q = cen + side * ((u - 0.5) * D) + up * ((v - 0.5) * D)
            h = sail_tree.ray_cast(q + nrm * 2, -nrm)
            if h[0] is None:
                h = sail_tree.ray_cast(q - nrm * 2, nrm)
            if h[0] is None:
                verts.append(None)
            else:
                n = h[1] if h[1].dot(nrm) * face > 0 else -h[1]
                verts.append(h[0] + n * 0.008)
            # seen from behind, the eye would read mirrored: the back face's u runs the other way
            uvs.append((u if face > 0 else 1 - u, v))
    decor.append(grid_mesh(f'eye_{"a" if face > 0 else "b"}', verts, uvs, N, N, lambda p, f=face: nrm * f, eye_mat))

# ---------------------------------------------------------------- the rudder head and tiller
# The rudder hangs on its irons along a raked hinge line: the irons' three pins (the small loose pieces of Object_5)
# lie on it. The head rises from the blade along that line, just aft of the sternpost, to clear the stern; the tiller
# is slotted through it and runs forward over the stern deck. Both take the blade's own wood (its UV patch), so the
# fitting matches the rudder. The rudder (blade, head and tiller) is its own node, turned about the hinge in the game.
def pieces(o):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    seen, out = set(), []
    for v in bm.verts:
        if v.index in seen: continue
        stack, comp = [v], []
        seen.add(v.index)
        while stack:
            a = stack.pop(); comp.append(a.co.copy())
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen: seen.add(b.index); stack.append(b)
        out.append(comp)
    bm.free()
    return out

pins = [sum(c, Vector()) / len(c) for c in pieces(bpy.data.objects['Object_5']) if 20 <= len(c) <= 100]
pc = sum(pins, Vector()) / len(pins)
Q = np.array([[p.x - pc.x, p.y - pc.y, p.z - pc.z] for p in pins])
axis = Vector(np.linalg.eigh(Q.T @ Q)[1][:, 2]).normalized()
if axis.z < 0: axis = -axis
pin_at = lambda Z: pc + axis * ((Z - pc.z) / axis.z)  # the hinge line at height Z (Blender frame)

blade = bpy.data.objects['Object_6']
wood = blade.data.materials[0]
buv = [d.uv for d in blade.data.uv_layers[0].data]
U0, U1 = min(u.x for u in buv), max(u.x for u in buv)
V0, V1 = min(u.y for u in buv), max(u.y for u in buv)

HEAD_AFT, HEAD_TOP, TILLER_Y, TILLER_LEN, TIP_DROP = 0.075, 1.38, 1.32, 0.82, 0.04
def beam(a, b, wa, wb, side):
    # a square-section timber from a to b, tapering from width wa to wb; side: a vector across it
    d = (b - a).normalized()
    s1 = (side - d * side.dot(d)).normalized()
    s2 = d.cross(s1)
    vs = []
    for p, w in ((a, wa), (b, wb)):
        for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            vs.append(p + s1 * (i * w / 2) + s2 * (j * w / 2))
    faces = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (3, 2, 1, 0), (4, 5, 6, 7)]
    return vs, faces

def helm_mesh():
    head_lo = pin_at(-0.05) + Vector((0, HEAD_AFT, 0))  # Blender +Y is aft
    head_hi = pin_at(HEAD_TOP) + Vector((0, HEAD_AFT, 0))
    at_tiller = pin_at(TILLER_Y) + Vector((0, HEAD_AFT, 0))
    t_aft = at_tiller + Vector((0, 0.07, 0))
    t_tip = Vector((at_tiller.x, at_tiller.y - TILLER_LEN, TILLER_Y - TIP_DROP))
    parts = [beam(head_lo, head_hi, 0.08, 0.075, Vector((1, 0, 0))), beam(t_aft, t_tip, 0.06, 0.038, Vector((1, 0, 0)))]
    me = bpy.data.meshes.new('helm')
    verts, faces = [], []
    for vs, fs in parts:
        o = len(verts); verts += vs; faces += [tuple(i + o for i in f) for f in fs]
    me.from_pydata(verts, [], faces)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    uvl = me.uv_layers.new(name='UVMap')
    corners = [(U0, V0), (U1, V0), (U1, V0 + (V1 - V0) * 0.35), (U0, V0 + (V1 - V0) * 0.35)]
    for p in me.polygons:
        for k, li in enumerate(p.loop_indices):
            uvl.data[li].uv = corners[k % 4]
    me.materials.append(wood)
    ob = bpy.data.objects.new('helm', me)
    bpy.context.scene.collection.objects.link(ob)
    grip = t_tip + (t_aft - t_tip).normalized() * 0.09
    return ob, grip

helm, grip = helm_mesh()
meshes.append(helm)

# ---------------------------------------------------------------- tiers: decimate, join by role, export
def decimate(o, r):
    if r >= 0.999:
        return
    mod = o.modifiers.new('dec', 'DECIMATE')
    mod.ratio = r
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=mod.name)

def tris(objs):
    n = 0
    for o in objs:
        o.data.calc_loop_triangles(); n += len(o.data.loop_triangles)
    return n

def build(tier, ratios):
    bpy.ops.object.select_all(action='DESELECT')
    copies = {'hull': [], 'sail': [], 'rudder': []}
    for o in meshes + decor:
        k = o.copy(); k.data = o.data.copy()
        bpy.context.scene.collection.objects.link(k)
        decimate(k, ratios.get(o.name, 1.0))
        role = 'sail' if o.name.startswith('eye') else 'hull' if o.name.startswith('bowboard') else ROLE[o.name]
        copies[role].append(k)
    out = []
    for role, objs in copies.items():
        bpy.ops.object.select_all(action='DESELECT')
        for k in objs: k.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        j = bpy.context.view_layer.objects.active
        j.name = role; j.data.name = role
        out.append(j)
    n = tris(out)
    bpy.ops.object.select_all(action='DESELECT')
    for j in out: j.select_set(True)
    bpy.ops.export_scene.gltf(filepath=f'{OUT}/dhow_{tier}.glb', export_format='GLB', use_selection=True,
                              export_yup=True, export_apply=True, export_image_format='AUTO')
    for j in out:
        bpy.data.objects.remove(j)
    print(f'TIER {tier} tris {n}')
    return n

for o in meshes + decor:
    o.hide_set(False)
n_lo = build('lo', LO)
n_hi = build('hi', HI)

# ---------------------------------------------------------------- what the game needs to know about the hull
hull = {
    'scale': SCALE,
    'source_tris': tris(meshes),
    'tris': {'lo': n_lo, 'hi': n_hi},
    'z0': round(z0, 3), 'len': round(length, 3), 'wl': WLW,
    'beam': round(max(WLW), 3),
    'box': {'x': round(max(abs(lo_all.x), abs(hi_all.x)), 3), 'z0': round(-hi_all.y, 3), 'z1': round(-lo_all.y, 3),
            'y0': round(lo_all.z, 3), 'y1': round(hi_all.z, 3)},
    'deck': profile,
    # the rudder's hinge (a point on it and its upward direction) and where the helmsman's hand holds the tiller
    'helm': {'pin': G(pin_at(0.0)), 'axis': [round(axis.x, 4), round(axis.z, 4), round(-axis.y, 4)], 'grip': G(grip)},
}
with open(HULL_JS, 'w') as f:
    f.write('// The dhow\'s hull as the game needs it, measured from the full-detail model by pipeline/lamu/dhow.py.\n')
    f.write('// Generated: edit the script, not this file. Game frame: metres, y up, bow toward +z, waterline y = 0.\n')
    f.write('//   z0, len: the waterline\'s run from the transom forward; wl: the hull\'s half-width at the waterline at 36\n')
    f.write('//   stations along it; box: the whole boat\'s bounds; deck: [z, y] of the floor and decks along the centre line.\n')
    f.write('export const HULL = ' + json.dumps(hull) + ';\n')
print('HULL', json.dumps(hull))
