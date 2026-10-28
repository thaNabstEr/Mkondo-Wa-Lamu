# Renders a model from fixed views (side, front, top, three-quarter) for before/after comparisons, so any processing
# step can be shown to keep the design. Workbench engine with the model's own textures, orthographic, framed on its
# bounds.
#   blender -b --python pipeline/lamu/render.py -- <file.glb> <out-prefix> [size=900] [only-object-substring]
import bpy, sys, math
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]
size = int(args[2]) if len(args) > 2 else 900
only = args[3] if len(args) > 3 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
if only:
    for o in meshes:
        o.hide_render = only not in o.name
    meshes = [o for o in meshes if not o.hide_render]
bpy.context.view_layer.update()
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
c = (lo + hi) / 2
ext = max((hi - lo).length, 1e-3)

sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'TEXTURE'
sc.display.shading.show_shadows = True
sc.render.resolution_x = sc.render.resolution_y = size
sc.render.film_transparent = False
sc.world = bpy.data.worlds.new('w')
sc.world.color = (0.55, 0.6, 0.65)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = 'ORTHO'
cam.data.ortho_scale = ext * 1.05
cam.data.clip_end = ext * 10

VIEWS = {'side': (0, -1, 0), 'front': (1, 0, 0), 'top': (0, 0, 1), 'quarter': (0.8, -1, 0.55)}
for name, d in VIEWS.items():
    d = Vector(d).normalized()
    cam.location = c + d * ext * 2
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y' if name != 'top' else 'X').to_euler()
    sc.render.filepath = f'{out}-{name}.png'
    bpy.ops.render.render(write_still=True)
print(f'BOUNDS min {tuple(round(v, 3) for v in lo)} max {tuple(round(v, 3) for v in hi)}')
