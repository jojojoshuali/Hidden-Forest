class Body // Store and update the properties of a 3D body that increntally moves from its previous place due to velocities.
{
  constructor(shape, material, size) {
    Object.assign(this, {
      shape,
      material,
      size
    })
  }
  emplace(location_matrix, linear_velocity, angular_velocity, spin_axis = Vec.of(0, 0, 0).randomized(1).normalized()) {
    this.center = location_matrix.times(Vec.of(0, 0, 0, 1)).to3();
    this.rotation = Mat4.translation(this.center.times(-1)).times(location_matrix);
    this.previous = {
      center: this.center.copy(),
      rotation: this.rotation.copy()
    };
    this.drawn_location = location_matrix; // This gets replaced with an interpolated quantity.
    return Object.assign(this, {
      linear_velocity,
      angular_velocity,
      spin_axis
    })
  }
  advance(time_amount) // Perform forward Euler to advance the linear and angular velocities one time-step.
  {
    this.previous = {
      center: this.center.copy(),
      rotation: this.rotation.copy()
    };
    // Apply the velocities scaled proportionally to real time (time_amount).
    this.center = this.center.plus(this.linear_velocity.times(time_amount)); // Apply linear velocity.
    this.rotation.pre_multiply(Mat4.rotation(time_amount * this.angular_velocity, this.spin_axis)); // Apply angular velocity.
  }
  blend_rotation(alpha) // We're naively just doing a linear blend of the rotations.  This looks
  { // ok sometimes but otherwise produces shear matrices, a wrong result.

    // TODO:  Replace this function with proper quaternion blending, and perhaps 
    // store this.rotation in quaternion form instead for compactness.
    return this.rotation.map((x, i) => Vec.from(this.previous.rotation[i]).mix(x, alpha));
  }
  blend_state(alpha) // Compute the final matrix we'll draw using the previous two physical locations
  // the object occupied.  We'll interpolate between these two states as described
  // at the end of the "Fix Your Timestep!" article by Glenn Fiedler.
  {
    this.drawn_location = Mat4.translation(this.previous.center.mix(this.center, alpha))
      .times(this.blend_rotation(alpha))
      .times(Mat4.scale(this.size));
  }
  check_if_colliding(b, a_inv, shape) // Collision detection function.
  // DISCLAIMER:  The collision method shown below is not used by anyone; it's just very quick 
  // to code.  Making every collision body an ellipsoid is kind of a hack, and looping 
  // through a list of discrete sphere points to see if the ellipsoids intersect is *really* a 
  // hack (there are perfectly good analytic expressions that can test if two ellipsoids 
  // intersect without discretizing them into points).
  {
    if (this == b) return false; // Nothing collides with itself.
    var T = a_inv.times(b.drawn_location); // Convert sphere b to the frame where a is a unit sphere.
    for (let p of shape.positions) // For each vertex in that b,
    {
      var Tp = T.times(p.to4(1)).to3(); // Shift to the coordinate frame of a_inv*b
      if (Tp.dot(Tp) < 1.1) // Check if in that coordinate frame it penetrates the unit sphere
        return true; // at the origin.  Leave .1 of leeway.     
    }
    return false;
  }
}

class Test_Data {
  constructor(context) {
    this.textures = { //rgb   : context.get_instance( "/assets/rgb.jpg"   ),
      //earth : context.get_instance( "/assets/earth.gif" ),
      //grid  : context.get_instance( "/assets/grid.png"  ),
      //stars : context.get_instance( "/assets/stars.png" ),
      fire: context.get_instance("/assets/fire.jpg")
      //text  : context.get_instance( "/assets/text.png"  )
    }
    this.shapes = { //donut  : new Torus          ( 15, 15 ),
      //cone   : new Closed_Cone    ( 4, 10 ),
      //capped : new Capped_Cylinder( 4, 12 ),
      ball: new Subdivision_Sphere(3)
      //cube   : new Cube()
      //axis   : new Axis_Arrows(),
      //prism  : new ( Capped_Cylinder   .prototype.make_flat_shaded_version() )( 10, 10 ),
      //gem    : new ( Subdivision_Sphere.prototype.make_flat_shaded_version() )( 2 ),
      //donut  : new ( Torus             .prototype.make_flat_shaded_version() )( 20, 20 ) 
    };
  }
  random_shape(shape_list = this.shapes) {
    const shape_names = Object.keys(shape_list);
    return shape_list[shape_names[~~(shape_names.length * Math.random())]]
  }
}


class Global_Info_Table extends Scene_Component // A class that just toggles, monitors, and reports some 
{
  make_control_panel() // global values via its control panel.
  {
    const globals = this.globals;
    globals.has_info_table = true;
    this.key_triggered_button("(Un)pause animation", ["Alt", "a"], function () {
      globals.animate ^= 1;
    });
    this.new_line();
    this.live_string(box => {
      box.textContent = "Animation Time: " + (globals.graphics_state.animation_time / 1000).toFixed(3) + "s"
    });
    this.live_string(box => {
      box.textContent = globals.animate ? " " : " (paused)"
    });
    this.new_line();
    this.key_triggered_button("Gouraud shading", ["Alt", "g"], function () {
      globals.graphics_state.gouraud ^= 1;
    });
    this.new_line();
    this.key_triggered_button("Normals shading", ["Alt", "n"], function () {
      globals.graphics_state.color_normals ^= 1;
    });
    this.new_line();

    const label = this.control_panel.appendChild(document.createElement("p"));
    label.style = "align:center";
    label.innerHTML = "A shared scratchpad is <br> accessible to all Scene_Components. <br> Navigate its values here:";

    const show_object = (element, obj = globals) => {
      if (this.box) this.box.innerHTML = "";
      else this.box = element.appendChild(Object.assign(document.createElement("div"), {
        style: "overflow:auto; width: 200px"
      }));
      if (obj !== globals)
        this.box.appendChild(Object.assign(document.createElement("div"), {
          className: "link",
          innerText: "(back to globals)",
          onmousedown: () => this.current_object = globals
        }))
      if (obj.to_string) return this.box.appendChild(Object.assign(document.createElement("div"), {
        innerText: obj.to_string()
      }));
      for (let [key, val] of Object.entries(obj)) {
        if (typeof (val) == "object")
          this.box.appendChild(Object.assign(document.createElement("a"), {
            className: "link",
            innerText: key,
            onmousedown: () => this.current_object = val
          }))
        else
          this.box.appendChild(Object.assign(document.createElement("span"), {
            innerText: key + ": " + val.toString()
          }));
        this.box.appendChild(document.createElement("br"));
      }
    }
    this.live_string(box => show_object(box, this.current_object));
  }
}

window.Grid_Patch = window.classes.Grid_Patch =
  class Grid_Patch extends Shape // A grid of rows and columns you can distort. A tesselation of triangles connects the
{ // points, generated with a certain predictable pattern of indices.  Two callbacks
  // allow you to dynamically define how to reach the next row or column.
  constructor(rows, columns, next_row_function, next_column_function, texture_coord_range = [
    [0, rows],
    [0, columns]
  ]) {
    super("positions", "normals", "texture_coords");
    let points = [];
    for (let r = 0; r <= rows; r++) {
      points.push(new Array(columns + 1)); // Allocate a 2D array.
      // Use next_row_function to generate the start point of each row. Pass in the progress ratio,
      points[r][0] = next_row_function(r / rows, points[r - 1] && points[r - 1][0]); // and the previous point if it existed.                                                                                                  
    }
    for (let r = 0; r <= rows; r++) // From those, use next_column function to generate the remaining points:
      for (let c = 0; c <= columns; c++) {
        if (c > 0) points[r][c] = next_column_function(c / columns, points[r][c - 1], r / rows);

        this.positions.push(points[r][c]);
        // Interpolate texture coords from a provided range.
        const a1 = c / columns,
          a2 = r / rows,
          x_range = texture_coord_range[0],
          y_range = texture_coord_range[1];
        this.texture_coords.push(Vec.of((a1) * x_range[1] + (1 - a1) * x_range[0], (a2) * y_range[1] + (1 - a2) * y_range[0]));
      }
    for (let r = 0; r <= rows; r++) // Generate normals by averaging the cross products of all defined neighbor pairs.
      for (let c = 0; c <= columns; c++) {
        let curr = points[r][c],
          neighbors = new Array(4),
          normal = Vec.of(0, 0, 0);
        for (let [i, dir] of [
            [-1, 0],
            [0, 1],
            [1, 0],
            [0, -1]
          ].entries()) // Store each neighbor by rotational order.
          neighbors[i] = points[r + dir[1]] && points[r + dir[1]][c + dir[0]]; // Leave "undefined" in the array wherever
        // we hit a boundary.
        for (let i = 0; i < 4; i++) // Take cross-products of pairs of neighbors, proceeding
          if (neighbors[i] && neighbors[(i + 1) % 4]) // a consistent rotational direction through the pairs:
            normal = normal.plus(neighbors[i].minus(curr).cross(neighbors[(i + 1) % 4].minus(curr)));
        normal.normalize(); // Normalize the sum to get the average vector.
        // Store the normal if it's valid (not NaN or zero length), otherwise use a default:
        if (normal.every(x => x == x) && normal.norm() > .01) this.normals.push(Vec.from(normal));
        else this.normals.push(Vec.of(0, 0, 1));
      }

    for (var h = 0; h < rows; h++) // Generate a sequence like this (if #columns is 10):  
      for (var i = 0; i < 2 * columns; i++) // "1 11 0  11 1 12  2 12 1  12 2 13  3 13 2  13 3 14  4 14 3..." 
        for (var j = 0; j < 3; j++)
          this.indices.push(h * (columns + 1) + columns * ((i + (j % 2)) % 2) + (~~((j % 3) / 2) ?
            (~~(i / 2) + 2 * (i % 2)) : (~~(i / 2) + 1)));
  }
  static sample_array(array, ratio) // Optional but sometimes useful as a next row or column operation. In a given array
  { // of points, intepolate the pair of points that our progress ratio falls between.  
    const frac = ratio * (array.length - 1),
      alpha = frac - Math.floor(frac);
    return array[Math.floor(frac)].mix(array[Math.ceil(frac)], alpha);
  }
}

window.Surface_Of_Revolution = window.classes.Surface_Of_Revolution =
  class Surface_Of_Revolution extends Grid_Patch // SURFACE OF REVOLUTION: Produce a curved "sheet" of triangles with rows and columns.
// Begin with an input array of points, defining a 1D path curving through 3D space -- 
// now let each such point be a row.  Sweep that whole curve around the Z axis in equal 
// steps, stopping and storing new points along the way; let each step be a column. Now
// we have a flexible "generalized cylinder" spanning an area until total_curvature_angle.
{
  constructor(rows, columns, points, texture_coord_range, total_curvature_angle = 2 * Math.PI) {
    const row_operation = i => Grid_Patch.sample_array(points, i),
      column_operation = (j, p) => Mat4.rotation(total_curvature_angle / columns, Vec.of(0, 0, 1)).times(p.to4(1)).to3();

    super(rows, columns, row_operation, column_operation, texture_coord_range);
  }
}

window.Cylindrical_Tube = window.classes.Cylindrical_Tube =
  class Cylindrical_Tube extends Surface_Of_Revolution // An open tube shape with equally sized sections, pointing down Z locally.    
{
  constructor(rows, columns, texture_range) {
    super(rows, columns, Vec.cast([1, 0, .5], [1, 0, -.5]), texture_range);
  }
}


window.Cube = window.classes.Cube =
  class Cube extends Shape // Here's a complete, working example of a Shape subclass.  It is a blueprint for a cube.
{
  constructor() {
    super("positions", "normals", "texture_coords"); // Name the values we'll define per each vertex.  They'll have positions and normals.

    // original definition overwritten due to https://piazza.com/class/jlwvwriv3g71xi?cid=93
    // set y change to 1 due to https://piazza.com/class/jlwvwriv3g71xi?cid=101
    // First, specify the vertex positions -- just a bunch of points that exist at the corners of an imaginary cube.
    const edge_length = 2;
    this.positions.push(...Vec.cast([-(edge_length / 2), -(edge_length / 2), -(edge_length / 2)], [(edge_length / 2), -(edge_length / 2), -(edge_length / 2)], [-(edge_length / 2), -(edge_length / 2), (edge_length / 2)], [(edge_length / 2), -(edge_length / 2), (edge_length / 2)], [(edge_length / 2), (edge_length / 2), -(edge_length / 2)], [-(edge_length / 2), (edge_length / 2), -(edge_length / 2)], [(edge_length / 2), (edge_length / 2), (edge_length / 2)], [-(edge_length / 2), (edge_length / 2), (edge_length / 2)],
      [-(edge_length / 2), -(edge_length / 2), -(edge_length / 2)], [-(edge_length / 2), -(edge_length / 2), (edge_length / 2)], [-(edge_length / 2), (edge_length / 2), -(edge_length / 2)], [-(edge_length / 2), (edge_length / 2), (edge_length / 2)], [(edge_length / 2), -(edge_length / 2), (edge_length / 2)], [(edge_length / 2), -(edge_length / 2), -(edge_length / 2)], [(edge_length / 2), (edge_length / 2), (edge_length / 2)], [(edge_length / 2), (edge_length / 2), -(edge_length / 2)],
      [-(edge_length / 2), -(edge_length / 2), (edge_length / 2)], [(edge_length / 2), -(edge_length / 2), (edge_length / 2)], [-(edge_length / 2), (edge_length / 2), (edge_length / 2)], [(edge_length / 2), (edge_length / 2), (edge_length / 2)], [(edge_length / 2), -(edge_length / 2), -(edge_length / 2)], [-(edge_length / 2), -(edge_length / 2), -(edge_length / 2)], [(edge_length / 2), (edge_length / 2), -(edge_length / 2)], [-(edge_length / 2), (edge_length / 2), -(edge_length / 2)]));
    // Supply vectors that point away from eace face of the cube.  They should match up with the points in the above list
    // Normal vectors are needed so the graphics engine can know if the shape is pointed at light or not, and color it accordingly.
    this.normals.push(...Vec.cast([0, -1, 0], [0, -1, 0], [0, -1, 0], [0, -1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [-1, 0, 0], [-1, 0, 0],
      [-1, 0, 0], [-1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1],
      [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]));

    this.texture_coords.push(...Vec.cast([0, 1], [1, 1], [0, 0], [1, 0], [0, 1], [1, 1], [0, 0], [1, 0],
      [0, 1], [1, 1], [0, 0], [1, 0], [0, 1], [1, 1], [0, 0], [1, 0],
      [0, 1], [1, 1], [0, 0], [1, 0], [0, 1], [1, 1], [0, 0], [1, 0]))

    // Those two lists, positions and normals, fully describe the "vertices".  What's the "i"th vertex?  Simply the combined
    // data you get if you look up index "i" of both lists above -- a position and a normal vector, together.  Now let's
    // tell it how to connect vertex entries into triangles.  Every three indices in this list makes one triangle:
    this.indices.push(0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6, 8, 9, 10, 9, 11, 10, 12, 13,
      14, 13, 15, 14, 16, 17, 18, 17, 19, 18, 20, 21, 22, 21, 23, 22);
    // It stinks to manage arrays this big.  Later we'll show code that generates these same cube vertices more automatically.
  }
}

window.Transforms_Sandbox = window.classes.Transforms_Sandbox =
  class Transforms_Sandbox extends Tutorial_Animation // This subclass of some other Scene overrides the display() function.  By only
{
  display(graphics_state) // exposing that one function, which draws everything, this creates a very small code
  // sandbox for editing a simple scene, and for experimenting with matrix transforms.
  {
    let model_transform = Mat4.identity(); // Variable model_transform will be a temporary matrix that helps us draw most shapes.
    // It starts over as the identity every single frame - coordinate axes at the origin.
    graphics_state.lights = this.lights; // Use the lights stored in this.lights.
    /**********************************
    Start coding down here!!!!
    **********************************/ // From here on down it's just some example shapes drawn for you -- freely replace them
    // with your own!  Notice the usage of the functions translation(), scale(), and rotation()
    // to generate matrices, and the functions times(), which generates products of matrices.

    const blue = Color.of(0, 0, 1, 1),
      yellow = Color.of(1, 1, 0, 1);
    model_transform = model_transform.times(Mat4.translation([0, 3, 20]));
    this.shapes.outline.draw(graphics_state, model_transform, this.white, "LINES"); // Draw the top box.

    const t = this.t = graphics_state.animation_time / 1000; // Find how much time has passed in seconds, and use that to place shapes.

    model_transform = model_transform.times(Mat4.translation([0, -2, 0])); // Tweak our coordinate system downward for the next shape.
    this.shapes.ball.draw(graphics_state, model_transform, this.plastic.override({
      color: blue
    })); // Draw the ball.

    if (!this.hover) // The first line below won't execute if the button on the page has been toggled:
      model_transform = model_transform.times(Mat4.rotation((t % 1.04719), Vec.of(0, 0, 1))) // Spin our coordinate frame as a function of time.
    model_transform = model_transform.times(Mat4.rotation(1, Vec.of(0, 0, 1))) // Rotate another axis by a constant value.
      .times(Mat4.scale([1, 2, 1])) // Stretch the coordinate frame.
      .times(Mat4.translation([0, -1, 0])); // Translate down enough for the two volumes to miss.
    this.shapes.box.draw(graphics_state, model_transform, this.plastic.override({
      color: yellow
    })); // Draw the bottom box.
  }
}

window.Cube_Outline = window.classes.Cube_Outline =
  class Cube_Outline extends Shape {
    constructor() {
      super("positions", "colors"); // Name the values we'll define per each vertex.



      this.positions = [Vec.of(-1, -1, -1), Vec.of(1, -1, -1),
        Vec.of(-1, -1, -1), Vec.of(-1, 1, -1),
        Vec.of(-1, -1, -1), Vec.of(-1, -1, 1),

        Vec.of(-1, 1, 1), Vec.of(1, 1, 1),
        Vec.of(-1, 1, 1), Vec.of(-1, -1, 1),
        Vec.of(-1, 1, 1), Vec.of(-1, 1, -1),

        Vec.of(1, 1, -1), Vec.of(-1, 1, -1),
        Vec.of(1, 1, -1), Vec.of(1, -1, -1),
        Vec.of(1, 1, -1), Vec.of(1, 1, 1),

        Vec.of(1, -1, 1), Vec.of(-1, -1, 1),
        Vec.of(1, -1, 1), Vec.of(1, 1, 1),
        Vec.of(1, -1, 1), Vec.of(1, -1, -1)
      ];


      this.colors = [Color.of(1, 1, 1, 1), Color.of(1, 1, 1, 1),
        Color.of(1, 1, 1, 1), Color.of(1, 1, 1, 1),
        Color.of(1, 1, 1, 1), Color.of(1, 1, 1, 1),
        Color.of(1, 1, 1, 1), Color.of(1, 1, 1, 1),

        Color.of(1, 1, 1, 1), Color.of(1, 1, 1, 1),
        Color.of(1, 1, 1, 1), Color.of(1, 1, 1, 1),
        Color.of(1, 1, 1, 1), Color.of(1, 1, 1, 1),
        Color.of(1, 1, 1, 1), Color.of(1, 1, 1, 1),

        Color.of(1, 1, 1, 1), Color.of(1, 1, 1, 1),
        Color.of(1, 1, 1, 1), Color.of(1, 1, 1, 1),
        Color.of(1, 1, 1, 1), Color.of(1, 1, 1, 1),
        Color.of(1, 1, 1, 1), Color.of(1, 1, 1, 1)
      ];
      //this.indices        = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

      // extra 2 done
      // First, specify the vertex positions -- just a bunch of points that exist at the corners of an imaginary cube.
      // this.positions.push( ...Vec.cast( [-1,-1,-1], [1,-1,-1], [-1,-1,1], [1,-1,1], [1,1,-1],  [-1,1,-1],  [1,1,1],  [-1,1,1],
      //                                 [-1,-1,-1], [-1,-1,1], [-1,1,-1], [-1,1,1], [1,-1,1],  [1,-1,-1],  [1,1,1],  [1,1,-1],
      //                               [-1,-1, 1],  [1,-1,1], [-1,1, 1], [1, 1,1], [1,-1,-1], [-1,-1,-1], [1,1,-1], [-1,1,-1] ) );
      // Supply vectors that point away from eace face of the cube.  They should match up with the points in the above list
      // Normal vectors are needed so the graphics engine can know if the shape is pointed at light or not, and color it accordingly.
      // this.colors.push(   ...Vec.cast( [1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],
      //                                 [1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],
      //                               [1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],
      //                             [1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1]) );
      // this.indices.push( 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23 );


      this.indexed = false; // Do this so we won't need to define "this.indices".



      // should be 24 pairs, each pair two points



      //  TODO (Requirement 5).
      // When a set of lines is used in graphics, you should think of the list entries as
      // broken down into pairs; each pair of vertices will be drawn as a line segment.

      //this.indexed = false;       // Do this so we won't need to define "this.indices".
    }
  }

window.Cube_Single_Strip = window.classes.Cube_Single_Strip =
  class Cube_Single_Strip extends Shape {
    constructor() {
      super("positions", "normals");




      this.positions.push(...Vec.cast([-1, 1, -1], [1, 1, -1], [-1, -1, -1], [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1], [-1, 1, -1], [-1, 1, 1], [-1, -1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]));

      this.normals.push(...Vec.cast([-1, 1, -1], [1, 1, -1], [-1, -1, -1], [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1], [-1, 1, -1], [-1, 1, 1], [-1, -1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]));

      this.indices.push(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13);

    }
  }

class Simulation extends Scene_Component // Simulation manages the stepping of simulation time.  Subclass it when making
{
  constructor(context, control_box) // a Scene that is a physics demo.  This technique is careful to totally
  {
    super(context, control_box); // decouple the simulation from the frame rate.
    Object.assign(this, {
      time_accumulator: 0,
      time_scale: 1,
      t: 0,
      dt: 1 / 20,
      bodies: [],
      steps_taken: 0
    });
  }
  simulate(frame_time) // Carefully advance time according to Glenn Fiedler's "Fix Your Timestep" blog post.
  {
    frame_time = this.time_scale * frame_time; // This line lets us create the illusion to the simulator that 
    // the display framerate is running fast or slow.
    // Avoid the spiral of death; limit the amount of time we will spend 
    this.time_accumulator += Math.min(frame_time, 0.1); // computing during this timestep if display lags.
    while (Math.abs(this.time_accumulator) >= this.dt) // Repeatedly step the simulation until we're caught up with this frame.
    {
      this.update_state(this.dt); // Single step of the simulation for all bodies.
      for (let b of this.bodies) b.advance(this.dt);

      this.t += Math.sign(frame_time) * this.dt; // Following the advice of the article, de-couple
      this.time_accumulator -= Math.sign(frame_time) * this.dt; // our simulation time from our frame rate.
      this.steps_taken++;
    }
    let alpha = this.time_accumulator / this.dt; // Store an interpolation factor for how close our frame fell in between
    for (let b of this.bodies) b.blend_state(alpha); // the two latest simulation time steps, so we can correctly blend the
  } // two latest states and display the result.
  make_control_panel() {
    this.key_triggered_button("Speed up time", ["Shift", "T"], function () {
      this.time_scale *= 5
    });
    this.key_triggered_button("Slow down time", ["t"], function () {
      this.time_scale /= 5
    });
    this.new_line();
    this.live_string(box => {
      box.textContent = "Time scale: " + this.time_scale
    });
    this.new_line();
    this.live_string(box => {
      box.textContent = "Fixed simulation time step size: " + this.dt
    });
    this.new_line();
    this.live_string(box => {
      box.textContent = this.steps_taken + " timesteps were taken so far."
    });
  }
  display(graphics_state) {
    if (!graphics_state.lights.length) graphics_state.lights = [new Light(Vec.of(7, 15, 20, 0), Color.of(1, 1, 1, 1), 100000)];

    if (this.globals.animate)
      this.simulate(graphics_state.animation_delta_time); // Advance the time and state of our whole simulation.
    for (let b of this.bodies)
      b.shape.draw(graphics_state, b.drawn_location, b.material); // Draw each shape at its current location.
  }
  update_state(dt) {
    throw "Override this"
  } // Your subclass of Simulation has to override this abstract function.
}

window.Assignment_One_Scene = window.classes.Assignment_One_Scene =
  class Assignment_One_Scene extends Simulation {
    constructor(context, control_box) // The scene begins by requesting the camera, shapes, and materials it will need.
    {
      super(context, control_box); // First, include a secondary Scene that provides movement controls:
      if (!context.globals.has_controls)
        context.register_scene_component(new Movement_Controls(context, control_box.parentElement.insertCell()));

      if (!context.globals.has_info_table)
        context.register_scene_component(new Global_Info_Table(context, control_box.parentElement.insertCell()));


      const r = context.width / context.height;
      context.globals.graphics_state.camera_transform = Mat4.translation([5, -10, -30]); // Locate the camera here (inverted matrix).
      context.globals.graphics_state.projection_transform = Mat4.perspective(Math.PI / 4, r, .1, 1000);

      this.data = new Test_Data(context);
      this.submit_shapes(context, this.data.shapes);

      const shapes = {
        'box': new Cube(),
        'square': new Square(),
        'bump_box': new Cube2(),
        'cat': new Shape_From_File("/assets/cat.obj"),
        'ufo': new Shape_From_File("/assets/ufo.obj"),
        'dog': new Shape_From_File("/assets/dog.obj"),
        'terrain': new Shape_From_File("/assets/terrain.obj"), // At the beginning of our program, load one of each of these shape
        'strip': new Cube_Single_Strip(), // definitions onto the GPU.  NOTE:  Only do this ONCE per shape
        'outline': new Cube_Outline(),
        'sphere': new(Subdivision_Sphere)(4),
        'planet_1': new(Subdivision_Sphere.prototype.make_flat_shaded_version())(2), // design.  Once you've told the GPU what the design of a cube is,
        'cylinder': new Cylindrical_Tube(15, 15)
      }

      this.material = context.get_instance(Phong_Shader).material(Color.of(.4, .8, .4, 1), {
        ambient: .4,
        texture: this.data.textures.fire
      });

      this.materials = {
        test: context.get_instance(Phong_Shader).material(Color.of(1, 1, 0, 1), {
          ambient: .2
        }),
        ring: context.get_instance(Ring_Shader).material(Color.of(0.4667, 0.2313, 0.2078, 1)),
        // TODO:  Fill in as many additional material objects as needed in this key/value table.
        //        (Requirement 1)
        //1001 yello
        sun: context.get_instance(Phong_Shader).material(Color.of(1, 0, 0, 1), {
          ambient: 1
        }),
        planet_1: context.get_instance(Phong_Shader).material(Color.of(1, 0.41, 0.7, 1), {
          ambient: 0.7, diffusivity: 1
        }),
        //0.745, 0.7647, 0.77647, 1
        planet_2: context.get_instance(Phong_Shader).material(Color.of(0.25098, 0.407843, 0.145098, 1), {
          diffusivity: 0.2
        }),
        planet_3: context.get_instance(Phong_Shader).material(Color.of(0.4667, 0.2313, 0.2078, 1)),
        planet_4: context.get_instance(Phong_Shader).material(Color.of(0.67843137, 0.84705882, 0.90196078, 1)),
        moon: context.get_instance(Phong_Shader).material(Color.of(0.5, 0.3, 0.2, 1)),
        texture1: context.get_instance(Texture_Rotate).material(Color.of(0, 0, 0, 1), {
          ambient: 1,
          texture: context.get_instance("assets/1.png", false)
        }),
        fire: context.get_instance(Phong_Shader).material(Color.of(0.5, 0, 0, 1)),
        texture1: context.get_instance(Phong_Shader).material(Color.of(0, 0, 0, 1), {
          ambient: 1,
          texture: context.get_instance("assets/moon.jpg", false)
        }),
        sky: context.get_instance(Texture_Rotate).material(Color.of(0, 0, 0, 1), {
          ambient: 1,
          texture: context.get_instance("assets/sky2.jpg", false)
        }),
        bump_box_shader_1: context.get_instance(Bump_Shader).material(Color.of(0, 0, 0, 1), {
          ambient: 1,
          texture: context.get_instance("assets/log_oak.png", false)
        }),
        bump_box_shader_2: context.get_instance(Bump_Shader).material(Color.of(0, 0, 0, 1), {
          ambient: 1,
          texture: context.get_instance("assets/magma.png", false)
        }),
        bump_box_shader_3: context.get_instance(Bump_Shader).material(Color.of(0, 0, 0.5, 1), {
          ambient: 1,
          texture: [context.get_instance("assets/blue.jpg", true), context.get_instance("assets/trophy.png", true)]
        }),
        game_o: context.get_instance(Phong_Shader).material(Color.of(0, 0, 0, 1), {
          ambient: 1,
          texture: context.get_instance("assets/game_over.png", false)
        }),

      }


      this.submit_shapes(context, shapes); // it would be redundant to tell it again.  You should just re-use
      // the one called "box" more than once in display() to draw
      // multiple cubes.  Don't define more than one blueprint for the
      // same thing here.

      // Material objects available:
      this.clay = context.get_instance(Phong_Shader).material(Color.of(.9, .5, .9, 1), {
        ambient: .4,
        diffusivity: .4
      });
      this.white = context.get_instance(Basic_Shader).material();
      this.plastic = this.clay.override({
        ambient: .8,
        specularity: .6
      });
      this.bump_mapped = context.get_instance(Bump_Map_Shader).material(Color.of(0.12, 0.56, 1, 0.85), {
        ambient: 0.5,
        diffusivity: .4,
        specularity: .6,
        texture: context.get_instance("assets/wave.jpg", false)
      });
      this.moon_bump = context.get_instance(Texture_Rotate).material(Color.of(0.753, 0.753, 0.753, 1), {
        ambient: 0.5,
        diffusivity: .4,
        specularity: .6,
        texture: context.get_instance("assets/moon.jpg", false)
      });
      this.cat_fur = context.get_instance(Phong_Shader).material(Color.of(.5, .5, .5, 1), {
        ambient: .3,
        diffusivity: .8,
        specularity: .8,
        texture: context.get_instance("/assets/cat_diff.png")
      });
      this.ufo_texture = context.get_instance(Phong_Shader).material(Color.of(0.68,1,0.18, 1), {
        ambient: .3,
        diffusivity: .9,
        specularity: .9,
        texture: context.get_instance("/assets/ufo_texture.png")
      });
      //0.2, 0.2, 0.2, 1
      this.terrain_color = context.get_instance(Phong_Shader).material(Color.of(0.1, 0.8, 0.2, 1), {
        ambient: .3,
        diffusivity: .1,
        specularity: .3,
        texture: context.get_instance("/assets/terrain.png")
      });
      this.canvas = context.canvas;
      this.dog_fur = context.get_instance(Phong_Shader).material(Color.of(.5, .5, .5, 1), {
        ambient: .3,
        diffusivity: .8,
        specularity: .8,
        texture: context.get_instance("/assets/dog_fur.png")
      });
      //         this.lights = [ new Light( Vec.of( 0,5,5,1 ), Color.of( 1, .4, 1, 1 ), 100000 ) ];
      this.lights = [new Light(Vec.of(0, 5, 5, 1), Color.of(1, 1, 1, 1), 100000)];
      this.set_colors();
      let model_transform = Mat4.identity();
      model_transform = this.draw_scene_helper(model_transform);
      this.trophy_state = model_transform.times(Mat4.translation([-5, 0, 17]));
      model_transform = model_transform.times(Mat4.translation([-6 * 2 + 2, 2, 12 + 2]));
      this.sphere_state = model_transform;
      this.enemy_state = model_transform.times(Mat4.translation([10, 10, 0]));
      //4
      this.enemy_state2 = this.enemy_state.times(Mat4.translation([2, 0, -2]));
      this.enemy_state3 = this.enemy_state2.times(Mat4.translation([-14, 0, 0]));
      this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, -4, -4]));
      this.enemy_state4 = this.enemy_state2.times(Mat4.translation([-2, 2, 0]));
      this.enemy_state5 = this.enemy_state2.times(Mat4.translation([-2, -12, 0]));
      this.stone_state = model_transform.times(Mat4.translation([6, 6, 0]));
      this.graphics_state = context.globals.graphics_state;
      this.camera_state = Mat4.identity();
      this.move_up = false;
      this.move_down = false;
      this.move_left = false;
      this.move_right = false;
      this.camera_changed = true;
      this.finished = false;
      this.counter = 0;
      this.intro = true;
      this.enemy_move = 0;
      this.moved = false;
      this.position_shpere = {
        surface: 1,
        row: 6,
        column: 1
      };
      this.chest_post = {
        surface: 5,
        row: 6,
        column: 1
      };
      this.chest_post1 = {
        surface: 2,
        row: 1,
        column: 6
      };
      this.chest_transform = this.enemy_state2.times(Mat4.translation([-14, 0, 0]));
      this.chest_transform1 = this.enemy_state2.times(Mat4.translation([0, -10, 0]));
      this.chest_transform2 = this.sphere_state.times(Mat4.translation([0, -2, -2]));
      this.show_world = true;
      this.set_color();
      this.tree_state = "F";
      this.tree_state1 = "F";
      this.tree_state2 = "F";
      this.tree_layer = 0;
      this.tree_layer1 = 0;
      this.tree_layer2 = 0;
      this.tree_layer_limit = 0;
      this.tree_layer_limit1 = 0;
      this.tree_layer_limit2 = 0;
      this.tree_len = 4;
      this.tree_len1 = 4;
      this.tree_len2 = 4;
      this.tree_model_transform = Mat4.identity();
      this.counter_1 = 0;

      this.ufo_finished_transform = false;


      this.scene1 = false;
      this.scene2 = false;
      this.scene3 = false;
      this.scene4 = false;
      this.scene5 = false;

      // game_over ufo
      this.cat_counter = 0; // ********
      this.ufo_counter = 0; // ********
      this.cat_model_transform = Mat4.identity(); // ********
      this.ufo_model_transform = this.sphere_state.times(Mat4.translation([-20, 0, 8]));
      this.position_shpere = {
        surface: 1,
        row: 6,
        column: 1
      };
      this.position_e1 = {
        surface: 1,
        row: 1,
        column: 6
      };
      this.position_e3 = {
        surface: 2,
        row: 3,
        column: 3
      };
      this.position_e2 = {
        surface: 5,
        row: 1,
        column: 1
      };
      this.position_e5 = {
        surface: 4,
        row: 1,
        column: 6
      };
      this.position_e4 = {
        surface: 3,
        row: 6,
        column: 6
      };

      this.e1_move = 2;
      this.e2_move = 2;
      this.e2_move_count = 0;
      this.game_over = false;
      this.UFO_game_over = false;
      this.change_board = false;

      //fireworks related variables
      this.fireworks = false;
      this.tube = false;
      this.tube_counter = 0;
      this.tube_model_transform = Mat4.translation([20, 20, -13]);

    }

    set_colors() {
      this.one = Color.of(0, 0, 1, 1);
      this.two = Color.of(1, 1, 0, 1);
      this.three = Color.of(0, 1, 1, 1);
      this.four = Color.of(0, 1, 0, 1);
      this.five = Color.of(1, 0, 0, 1);
      this.six = Color.of(1, 0, 1, 1);
      this.seven = Color.of(0.6, 0.2, 0.5, 1);
      this.eight = Color.of(0.6, 0.6, 0.2, 1);

      this.dict = {
        1: this.one,
        2: this.two,
        3: this.three,
        4: this.four,
        5: this.five,
        6: this.six,
        7: this.seven,
        8: this.eight
      };
      this.color_arr = [1, 2, 3, 4, 5, 6, 7, 8];
      var i;
      this.color_arr[0] = Math.floor(Math.random() * 8) + 1;
      for (i = 1; i < 8; i++) {
        this.color_arr[i] = Math.floor(Math.random() * 8) + 1;
        if (this.color_arr[i] == this.color_arr[i - 1]) {

          //this.color_arr[i] = Math.floor(Math.random()*8) + 1;
          i = i - 1;
        }
      }

    }


    set_color() {
      this.colors = [];
      for (var i = 0; i < 8; i++) {
        this.colors.push(
          Color.of(
            1,
            1,
            1,
            1,
          )
        );
      }
    }


    make_control_panel() // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
    {
      this.key_triggered_button("move up", ["g"], () => {
        this.move_up = true;
        this.move_down = false;
        this.move_left = false;
        this.move_right = false;
        this.moved = true;

      }); // Add a button for controlling the scene.
      this.key_triggered_button("move left", ["h"], () => {
        this.move_left = true;
        this.move_up = false;
        this.move_down = false;
        this.move_right = false;
        this.moved = true;
      });
      this.key_triggered_button("move right", ["j"], () => {
        this.move_left = false;
        this.move_up = false;
        this.move_down = false;
        this.move_right = true;
        this.moved = true;
      });
      this.key_triggered_button("move down", ["k"], () => {
        this.move_left = false;
        this.move_up = false;
        this.move_down = true;
        this.move_right = false;
        this.moved = true;
      });
    }

    draw_scene_helper(model_transform) {
      model_transform = model_transform.times(Mat4.translation([(-6 * 2), 3, 0]));

      var i;
      for (i = 0; i < 6; i++) {
        model_transform = model_transform.times(Mat4.translation([2, 0, 0]));

        var j;
        let temp2 = model_transform.times(Mat4.translation([0, 0, 0]));
        for (j = 0; j < 6; j++) {

          model_transform = model_transform.times(Mat4.translation([0, 2, 0]));
          var k;
          let temp3 = model_transform.times(Mat4.translation([0, 0, 0]));
          for (k = 0; k < 6; k++) {
            model_transform = model_transform.times(Mat4.translation([0, 0, 2]));
          }
          model_transform = temp3;
        }
        model_transform = temp2;
      }
      return model_transform;
    }


    draw_scene_wrapper(graphics_state, model_transform) {

      const edge_length = 2; // change this to whatever value you guys want for the length of the edges

      const t = this.t = graphics_state.animation_time / 1000;
      const white = Color.of(1, 1, 1, 1);
      const blue = Color.of(0, 0, 1, 1);
      model_transform = model_transform.times(Mat4.translation([(-6 * edge_length), 3, 0]));

      var i;

      for (i = 0; i < 6; i++) {

        model_transform = model_transform.times(Mat4.translation([edge_length, 0, 0]));
        var j;
        let temp2 = model_transform.times(Mat4.translation([0, 0, 0]));
        for (j = 0; j < 6; j++) {
          model_transform = model_transform.times(Mat4.translation([0, edge_length, 0]));
          var k;
          let temp3 = model_transform.times(Mat4.translation([0, 0, 0]));
          for (k = 0; k < 6; k++) {
            model_transform = model_transform.times(Mat4.translation([0, 0, edge_length]));
            if ((i + j + k) % 2 == 0) {

              this.shapes.box.draw(graphics_state, model_transform,
                this.plastic.override({
                  color: white
                })
              );

            } else {

              this.shapes.box.draw(graphics_state, model_transform,
                this.plastic.override({
                  color: blue
                }));

            }

          }
          model_transform = temp3;
        }
        model_transform = temp2;
      }
      return model_transform;
    }


    growth() {
      let new_tree_state = "";

      for (var i = 0; i < this.tree_state.length; i++) {
        if (this.tree_state[i] === 'F') {
          new_tree_state += "FF+[+F-F-F]-[-F+F+F]";
        } else {
          new_tree_state += this.tree_state[i];
        }
      }

      this.tree_state = new_tree_state;
      console.log(this.tree_state);
      this.tree_layer++;
      this.tree_len *= 0.5;
    }

    draw_box(graphics_state, model_transform, i) {
      this.shapes.box.draw(
        graphics_state,
        model_transform.times(Mat4.scale([0.3, 1, 0.3])),
        this.plastic.override({
          color: Color.of(0,1,0.5,1)
        }),
      );
      // this.shapes.outline.draw(graphics_state, model_transform, this.white, "LINES");
      return model_transform;
    }


    draw_tree(graphics_state, model_transform) {
      let t = this.t = graphics_state.animation_time / 1000;
      if (this.tree_layer < this.tree_layer_limit) {
        this.growth();
      }

      var stack = [];

      model_transform = model_transform.times(Mat4.scale([1, this.tree_len, 1]));

      for (var i = 0; i < this.tree_state.length; i++) {
        let cur = this.tree_state[i];
        if (cur === 'F') {
          model_transform = this.draw_box(graphics_state, model_transform, 0);
          model_transform = model_transform.times(Mat4.translation([0, 2, 0]));
        } else if (cur === '+') {
          model_transform = model_transform.times(Mat4.rotation(0.436332, Vec.of(0, 0, -1)));
        } else if (cur === '-') {
          model_transform = model_transform.times(Mat4.rotation(0.436332, Vec.of(0, 0, 1)));
        } else if (cur === '[') {
          stack.push(model_transform);
        } else if (cur === ']') {
          model_transform = stack.pop();
        }
      }
    }

    growth1() {
      let new_tree_state = "";

      for (var i = 0; i < this.tree_state1.length; i++) {
        if (this.tree_state1[i] === 'F') {
          new_tree_state += "FF+[+F-F-F]-[-F+F+F]";
        } else {
          new_tree_state += this.tree_state1[i];
        }
      }

      this.tree_state1 = new_tree_state;
      console.log(this.tree_state1);
      this.tree_layer1++;
      this.tree_len1 *= 0.5;
    }



    draw_tree2(graphics_state, model_transform) {
      let t = this.t = graphics_state.animation_time / 1000;
      if (this.tree_layer1 < this.tree_layer_limit1) {
        this.growth1();
      }

      var stack = [];

      model_transform = model_transform.times(Mat4.scale([1, this.tree_len1, 1]));

      for (var i = 0; i < this.tree_state1.length; i++) {
        let cur = this.tree_state1[i];
        if (cur === 'F') {
          model_transform = this.draw_box(graphics_state, model_transform, 0);
          model_transform = model_transform.times(Mat4.translation([0, 2, 0]));
        } else if (cur === '+') {
          model_transform = model_transform.times(Mat4.rotation(0.436332, Vec.of(0, 0, -1)));
        } else if (cur === '-') {
          model_transform = model_transform.times(Mat4.rotation(0.436332, Vec.of(0, 0, 1)));
        } else if (cur === '[') {
          stack.push(model_transform);
        } else if (cur === ']') {
          model_transform = stack.pop();
        }
      }
    }

    growth2() {
      let new_tree_state = "";

      for (var i = 0; i < this.tree_state2.length; i++) {
        if (this.tree_state2[i] === 'F') {
          new_tree_state += "FF+[+F-F-F]-[-F+F+F]";
        } else {
          new_tree_state += this.tree_state2[i];
        }
      }

      this.tree_state2 = new_tree_state;
      console.log(this.tree_state2);
      this.tree_layer2++;
      this.tree_len2 *= 0.5;
    }



    draw_tree3(graphics_state, model_transform) {
      let t = this.t = graphics_state.animation_time / 1000;
      if (this.tree_layer2 < this.tree_layer_limit2) {
        this.growth2();
      }

      var stack = [];

      model_transform = model_transform.times(Mat4.scale([1, this.tree_len2, 1]));

      for (var i = 0; i < this.tree_state2.length; i++) {
        let cur = this.tree_state2[i];
        if (cur === 'F') {
          model_transform = this.draw_box(graphics_state, model_transform, 0);
          model_transform = model_transform.times(Mat4.translation([0, 2, 0]));
        } else if (cur === '+') {
          model_transform = model_transform.times(Mat4.rotation(0.436332, Vec.of(0, 0, -1)));
        } else if (cur === '-') {
          model_transform = model_transform.times(Mat4.rotation(0.436332, Vec.of(0, 0, 1)));
        } else if (cur === '[') {
          stack.push(model_transform);
        } else if (cur === ']') {
          model_transform = stack.pop();
        }
      }
    }





    red_color() {
      return this.material.override({
        color: Color.of(.6, .6 * Math.random(), .6 * Math.random(), 1)
      });
    }

    update_state(dt) {
      if (this.fireworks) {
        while (this.bodies.length < 80) // Generate moving bodies:
          this.bodies.push(new Body(this.data.random_shape(), this.red_color(), Vec.of(1, 1 + Math.random(), 1))
            .emplace(Mat4.translation(Vec.of(20, 20, 20).randomized(2)),
              Vec.of(0, 0, -1).randomized(2).normalized().times(3), Math.random()));

        for (let b of this.bodies) {
          b.linear_velocity[2] += dt * -9.8; // Gravity
          if (b.center[2] < -8 && b.linear_velocity[2] < 0)
            b.linear_velocity[2] *= -.8; // If about to fall through floor, reverse z velocity.
        } // Delete bodies that stop or stray too far away.
        this.bodies = this.bodies.filter(b => b.center.norm() < 45 && b.linear_velocity.norm() > 2);
      }
    }


    display(graphics_state) {
      super.display(graphics_state);

      graphics_state.lights = this.lights;
      const t = graphics_state.animation_time / 1000,
        dt = graphics_state.animation_delta_time / 200;
      // Use the lights stored in this.lights.

      // tube
      if (this.tube)
      {
        if (this.tube_counter < 18)
        {
          this.tube_counter += 2 * dt;
          this.tube_model_transform = this.tube_model_transform.times(Mat4.translation([0, 0, 2 * dt]));
          
        }
        else
        {
          this.fireworks = true;
          this.tube = false;
        }
        //this.shapes.cylinder.draw(graphics_state, this.tube_model_transform, this.materials.fire);
        //this.fireworks = true;
      }

      if (this.UFO_game_over) {

        if (this.ufo_counter < 20) { // when ufo is not on the top of cat, move ufo to the top of cat
          this.ufo_counter += 2 * dt;
          this.ufo_model_transform = this.ufo_model_transform.times(Mat4.translation([2 * dt, 0, 0]));
        } else { // when ufo is on top of cat, move cat up to ufo
          if (this.cat_counter < 8) { // when cat is still below ufo
            this.cat_counter += 1.5 * dt;
            this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, 1.5 * dt]));
          } else {
            this.cat_in_ufo = true;
            if (this.ufo_counter < 100) {
              this.ufo_counter += 8 * dt;
              this.ufo_model_transform = this.ufo_model_transform.times(Mat4.translation([8 * dt, 0, 0]));
            } else {
              this.game_over = true;
            }
          }

        }

        // draw ufo TODO: CHANGE UFO 
        // this.shapes.box.draw(
        //   graphics_state,
        //   this.ufo_model_transform,
        //   this.plastic.override({
        //     color: Color.of(1, 0.5, 1, 1)
        //   }),
        // );

        this.shapes.ufo.draw(
          graphics_state,
          this.ufo_model_transform.times(Mat4.scale([3, 3, 1])),
          this.ufo_texture,
        );
      }

      if (this.scene1 && this.scene2 && this.scene3 && this.scene4 && this.scene5) {
        // WIN 
        this.graphics_state.camera_transform = this.camera_state;

        this.shapes.bump_box.draw(graphics_state, this.trophy_state.times(Mat4.scale([6, 6, 6])), this.materials.bump_box_shader_3);

      }



      if (this.game_over || this.position_shpere.surface == 6) {
        const temp = Mat4.inverse(this.camera_state);
        graphics_state.camera_transform = Mat4.inverse(temp.times(Mat4.translation([0, -30, 0])));
        let model_transform = temp.times(Mat4.translation([0, -30, -10]));
        let model_transform_2 = model_transform.times(Mat4.translation([0, 0, -100]))
          .times(Mat4.scale([150, 150, 150]));
        let t1 = graphics_state.animation_time / 1000;
        model_transform_2 = model_transform_2.times(Mat4.rotation((t1 * Math.PI / 20), Vec.of(1, 0, 1)));
        this.shapes.sphere.draw(graphics_state, model_transform_2, this.bump_mapped);
        this.shapes.cat.draw(graphics_state, model_transform.times(Mat4.translation([0, -2.5, 0])), this.cat_fur);
        this.shapes.square.draw(graphics_state, model_transform.times(Mat4.translation([0, 0.5, 5])), this.materials.game_o);
        return;
      }



      if (this.show_world || this.counter_1 < 20) {
        const temp = Mat4.inverse(graphics_state.camera_transform);
        if (this.intro == true) {
          this.camera_state = Mat4.inverse(temp.times(Mat4.rotation(0.6 * Math.PI, Vec.of(1, 1, 1.5)))
            .times(Mat4.translation([1, -20, 30]))
            .times(Mat4.translation([-24, 8, -32]))
            .times(Mat4.rotation(1.5 * Math.PI, Vec.of(0, 1, 0)))
            .times(Mat4.rotation(-0.12 * Math.PI, Vec.of(0, 0, 3)))
            .times(Mat4.translation([-2, 0, 10])));
          this.intro = false;
        }
        graphics_state.camera_transform = Mat4.inverse(temp.times(Mat4.rotation(Math.PI * 0.003, Vec.of(0, 1, 1)))
          .times(Mat4.translation([0, 0, 1])));
        this.counter_1 = this.counter_1 + dt;
        this.show_world = false;
      } else if (this.position_shpere.surface == 1 && this.camera_changed && this.moved) {
        const temp = Mat4.inverse(this.camera_state);
        graphics_state.camera_transform = Mat4.inverse(temp.times(Mat4.rotation(-Math.PI * 0.2, Vec.of(1, 0, 0)))
                                                           .times(Mat4.translation([0,10,5])));

        this.camera_changed = false;

      } else if (this.position_shpere.surface == 5 && this.camera_changed && this.moved) {
        const temp = Mat4.inverse(this.camera_state);
        graphics_state.camera_transform = Mat4.inverse(temp.times(Mat4.rotation(0.6 * Math.PI, Vec.of(1, 1, 2)))
          .times(Mat4.translation([1, -20, 30]))
          .times(Mat4.rotation(-0.5 * Math.PI, Vec.of(0, 0, 1)))
          .times(Mat4.translation([10, -2, 0]))
          .times(Mat4.translation([0, -4, 0]))
          .times(Mat4.rotation(-0.06 * Math.PI, Vec.of(0.2, 1, 1))));
        this.camera_changed = false;

      } else if (this.position_shpere.surface == 4 && this.camera_changed && this.moved) {
        const temp = Mat4.inverse(this.camera_state);
        graphics_state.camera_transform = Mat4.inverse(temp.times(Mat4.translation([0, -10, 10])));
        this.camera_changed = false;

      } else if (this.position_shpere.surface == 3 && this.camera_changed && this.moved) {
        const temp = Mat4.inverse(this.camera_state);
        graphics_state.camera_transform = Mat4.inverse(temp.times(Mat4.translation([0, 0, -40]))
          .times(Mat4.rotation(Math.PI, Vec.of(0, 1, 0)))
          .times(Mat4.translation([0, -10, 40]))
           .times(Mat4.rotation(-0.25*Math.PI, Vec.of(0,1,0)))
           .times(Mat4.translation([0,0,5]))
           .times(Mat4.translation([-18,0,0])));
        this.camera_changed = false;
      } else if (this.position_shpere.surface == 2 && this.camera_changed && this.moved) {
        const temp = Mat4.inverse(this.camera_state);
        graphics_state.camera_transform = Mat4.inverse(temp.times(Mat4.translation([10, 0, -20]))
          .times(Mat4.rotation(-0.4 * Math.PI, Vec.of(0, 1, 0)))
          .times(Mat4.translation([-10, -10, 50])));

        this.camera_changed = false;
      }


      let model_transform = Mat4.identity();
      model_transform = this.draw_scene_wrapper(graphics_state, model_transform);
      let model_transform_2 = Mat4.identity();
      model_transform_2 = model_transform;
      const white = Color.of(1, 0, 1, 1);
      const yellow = Color.of(0, 1, 1, 1);




      if (this.move_up == true) {
        if (this.counter < 2) {
          if (this.position_shpere.surface == 1 || this.position_shpere.surface == 2 || this.position_shpere.surface == 5)
            this.sphere_state = this.sphere_state.times(Mat4.translation([0, dt, 0]));
          else if (this.position_shpere.surface == 3)
            this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, -dt]));
          else if (this.position_shpere.surface == 4)
            this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, dt]));
          else if (this.position_shpere.surface == 6)
            this.sphere_state = this.sphere_state.times(Mat4.translation([0, -dt, 0]));
          this.counter = dt + this.counter;
        } else {
          this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, 0]));
          this.move_up = false;
          this.counter = 0;
          this.position_shpere.row--;
          if (this.position_shpere.row == 0) {
            if (this.position_shpere.surface == 1) {
              this.camera_changed = true;
              this.position_shpere.surface = 3;
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, -2]));
              this.position_shpere.row = 6;
            } else if (this.position_shpere.surface == 4) {
              this.camera_changed = true;
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, 2, 0]));
              this.position_shpere.surface = 1;
              this.position_shpere.row = 6;
            } else if (this.position_shpere.surface == 2) {
              this.sphere_state = this.sphere_state.times(Mat4.translation([2, 0, 0]));
              this.position_shpere.surface = 3;
              this.camera_changed = true;
              const temp1 = this.position_shpere.row;
              const temp2 = this.position_shpere.column;
              this.position_shpere.column = 1;
              this.position_shpere.row = temp2;
            } else if (this.position_shpere.surface == 5) {
              this.sphere_state = this.sphere_state.times(Mat4.translation([-2, 0, 0]));
              this.position_shpere.surface = 3;
              this.camera_changed = true;
              const temp1 = 7 - this.position_shpere.column;
              this.position_shpere.column = 6;
              this.position_shpere.row = temp1;
            } else if (this.position_shpere.surface == 3) {
              this.position_shpere.surface = 6;
              this.position_shpere.row = 6;
              this.camera_changed = true;
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, -2, 0]));
            } else if (this.position_shpere.surface == 6) {
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, 2]));
              this.position_shpere.surface = 4;
              this.position_shpere.row = 6;
              this.camera_changed = true;
            }

          }

          //enemy's turn to move
          if (this.enemy_move < 5) {
            this.enemy_state = this.enemy_state.times(Mat4.translation([0, -this.e1_move, 0]));

            if (this.e1_move > 0)
              this.position_e1.row++;
            else
              this.position_e1.row--;
            this.enemy_move++;
          } else if (this.enemy_move < 10) {
            this.enemy_state = this.enemy_state.times(Mat4.translation([-this.e1_move, 0, 0]));
            if (this.e1_move > 0)
              this.position_e1.column--;
            else
              this.position_e1.column++;
            this.enemy_move++;
          } else {
            this.enemy_move = 0;
            this.e1_move = -this.e1_move;
          }

          if (this.enemy_move % 4 == 0) {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, 0, 2]));
            this.position_e3.column_++;
          } else if (this.enemy_move % 4 == 1) {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, 2, 0]))
            this.position_e3.row--;
          } else if (this.enemy_move % 4 == 2) {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, 0, -2]));
            this.position_e3.column--;
          } else {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, -2, 0]));
            this.position_e3.row++;
          }
          if (this.e2_move_count < 5) {
            this.e2_move_count++;
            this.enemy_state2 = this.enemy_state2.times(Mat4.translation([0, 0, -this.e2_move]));
            this.enemy_state5 = this.enemy_state5.times(Mat4.translation([-this.e2_move, 0, 0]));
            if (this.e2_move > 0) {
              this.position_e2.column++;
              this.position_e5.column--;
            } else {
              this.position_e2.column--;
              this.position_e5.column++;
            }
          } else {
            this.e2_move = -this.e2_move;
            this.e2_move_count = 0;
          }
        }
      }
      if (this.move_down == true) {
        if (this.counter < 2) {
          if (this.position_shpere.surface == 1 || this.position_shpere.surface == 2 || this.position_shpere.surface == 5)
            this.sphere_state = this.sphere_state.times(Mat4.translation([0, -dt, 0]));
          else if (this.position_shpere.surface == 3)
            this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, dt]));
          else if (this.position_shpere.surface == 4)
            this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, -dt]));
          else if (this.position_shpere.surface == 6)
            this.sphere_state = this.sphere_state.times(Mat4.translation([0, dt, 0]));
          this.counter = dt + this.counter;
        } else {
          this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, 0]));
          this.move_down = false;
          this.counter = 0;
          this.position_shpere.row++;
          if (this.position_shpere.row > 6) {
            if (this.position_shpere.surface == 3) {
              this.position_shpere.surface = 1;
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, -2, 0]));
              this.position_shpere.row = 1;
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 1) {
              this.position_shpere.surface = 4;
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, -2]));
              this.position_shpere.row = 1;
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 2) {
              this.position_shpere.surface = 4;
              this.sphere_state = this.sphere_state.times(Mat4.translation([2, 0, 0]));
              const temp1 = this.position_shpere.column;
              this.position_shpere.column = 1;
              this.position_shpere.row = 7 - temp1;
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 5) {
              this.position_shpere.surface = 4;
              this.sphere_state = this.sphere_state.times(Mat4.translation([-2, 0, 0]));
              const temp1 = this.position_shpere.column;
              this.position_shpere.row = temp1;
              this.position_shpere.column = 6;
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 6) {
              this.position_shpere.surface = 3;
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, 2]));
              this.position_shpere.row = 1;
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 4) {
              this.position_shpere.surface = 6;
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, 2, 0]));
              this.position_shpere.row = 1;
              this.camera_changed = true;
            }

          }
          //enemy's turn to move
          if (this.enemy_move < 5) {
            this.enemy_state = this.enemy_state.times(Mat4.translation([0, -this.e1_move, 0]));

            if (this.e1_move > 0)
              this.position_e1.row++;
            else
              this.position_e1.row--;
            this.enemy_move++;
          } else if (this.enemy_move < 10) {
            this.enemy_state = this.enemy_state.times(Mat4.translation([-this.e1_move, 0, 0]));
            if (this.e1_move > 0)
              this.position_e1.column--;
            else
              this.position_e1.column++;
            this.enemy_move++;
          } else {
            this.enemy_move = 0;
            this.e1_move = -this.e1_move;
          }

          if (this.enemy_move % 4 == 0) {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, 0, 2]));
            this.position_e3.column_++;
          } else if (this.enemy_move % 4 == 1) {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, 2, 0]))
            this.position_e3.row--;
          } else if (this.enemy_move % 4 == 2) {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, 0, -2]));
            this.position_e3.column--;
          } else {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, -2, 0]));
            this.position_e3.row++;
          }
          if (this.e2_move_count < 5) {
            this.e2_move_count++;
            this.enemy_state2 = this.enemy_state2.times(Mat4.translation([0, 0, -this.e2_move]));
            this.enemy_state5 = this.enemy_state5.times(Mat4.translation([-this.e2_move, 0, 0]));
            if (this.e2_move > 0) {
              this.position_e2.column++;
              this.position_e5.column--;
            } else {
              this.position_e2.column--;
              this.position_e5.column++;
            }
          } else {
            this.e2_move = -this.e2_move;
            this.e2_move_count = 0;
          }
        }
      }
      if (this.move_right == true) {
        if (this.counter < 2) {
          if (this.position_shpere.surface == 1 || this.position_shpere.surface == 3 || this.position_shpere.surface == 4 || this.position_shpere.surface == 6)
            this.sphere_state = this.sphere_state.times(Mat4.translation([dt, 0, 0]));
          else if (this.position_shpere.surface == 2)
            this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, dt]));
          else if (this.position_shpere.surface == 5)
            this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, -dt]));
          this.counter = dt + this.counter;
        } else {
          this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, 0]));
          this.move_right = false;
          this.counter = 0;
          this.position_shpere.column++;
          if (this.position_shpere.column > 6) {
            if (this.position_shpere.surface == 2) {
              this.sphere_state = this.sphere_state.times(Mat4.translation([2, 0, 0]));
              this.position_shpere.surface = 1;
              this.position_shpere.column = 1;
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 1) {
              this.position_shpere.surface = 5;
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, -2]));
              this.position_shpere.column = 1;
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 4) {
              this.position_shpere.surface = 5;
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, 2, 0]));
              const temp1 = this.position_shpere.row;
              this.position_shpere.column = temp1;
              this.position_shpere.row = 6;
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 3) {
              this.position_shpere.surface = 5;
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, -2, 0]));
              const temp1 = 7 - this.position_shpere.row;
              this.position_shpere.column = temp1;
              this.position_shpere.row = 1;
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 5) {
              this.position_shpere.surface = 6;
              this.sphere_state = this.sphere_state.times(Mat4.translation([-2, 0, 0]));
              const temp1 = 7 - this.position_shpere.row;
              this.position_shpere.row = temp1;
              this.position_shpere.column = 6;
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 6) {
              this.position_shpere.surface = 5;
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, 2]));
              const temp1 = 7 - this.position_shpere.row;
              this.position_shpere.row = temp1;
              this.position_shpere.column = 6;
              this.camera_changed = true;
            }

          }
          //enemy's turn to move
          if (this.enemy_move < 5) {
            this.enemy_state = this.enemy_state.times(Mat4.translation([0, -this.e1_move, 0]));

            if (this.e1_move > 0)
              this.position_e1.row++;
            else
              this.position_e1.row--;
            this.enemy_move++;
          } else if (this.enemy_move < 10) {
            this.enemy_state = this.enemy_state.times(Mat4.translation([-this.e1_move, 0, 0]));
            if (this.e1_move > 0)
              this.position_e1.column--;
            else
              this.position_e1.column++;
            this.enemy_move++;
          } else {
            this.enemy_move = 0;
            this.e1_move = -this.e1_move;
          }

          if (this.enemy_move % 4 == 0) {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, 0, 2]));
            this.position_e3.column_++;
          } else if (this.enemy_move % 4 == 1) {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, 2, 0]))
            this.position_e3.row--;
          } else if (this.enemy_move % 4 == 2) {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, 0, -2]));
            this.position_e3.column--;
          } else {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, -2, 0]));
            this.position_e3.row++;
          }
          if (this.e2_move_count < 5) {
            this.e2_move_count++;
            this.enemy_state2 = this.enemy_state2.times(Mat4.translation([0, 0, -this.e2_move]));
            this.enemy_state5 = this.enemy_state5.times(Mat4.translation([-this.e2_move, 0, 0]));
            if (this.e2_move > 0) {
              this.position_e2.column++;
              this.position_e5.column--;
            } else {
              this.position_e2.column--;
              this.position_e5.column++;
            }
          } else {
            this.e2_move = -this.e2_move;
            this.e2_move_count = 0;
          }
        }
      }
      if (this.move_left == true) {
        if (this.counter < 2) {
          if (this.position_shpere.surface == 1 || this.position_shpere.surface == 3 || this.position_shpere.surface == 4 || this.position_shpere.surface == 6)
            this.sphere_state = this.sphere_state.times(Mat4.translation([-dt, 0, 0]));
          else if (this.position_shpere.surface == 2)
            this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, -dt]));
          else if (this.position_shpere.surface == 5)
            this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, dt]));
          this.counter = dt + this.counter;
        } else {
          this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, 0]));
          this.move_left = false;
          this.counter = 0;
          this.position_shpere.column--;
          if (this.position_shpere.column == 0) {
            if (this.position_shpere.surface == 1) {
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, -2]));
              this.position_shpere.surface = 2;
              this.position_shpere.column = 6;
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 5) {
              this.position_shpere.surface = 1;
              this.sphere_state = this.sphere_state.times(Mat4.translation([-2, 0, 0]));
              this.position_shpere.column = 6;
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 3) {
              this.position_shpere.surface = 2;
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, -2, 0]));
              const temp1 = this.position_shpere.row;
              const temp2 = this.position_shpere.column;
              this.position_shpere.row = 1;
              this.position_shpere.column = temp1;
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 4) {
              const temp1 = this.position_shpere.row;
              this.position_shpere.column = 7 - temp1;
              this.position_shpere.row = 6;
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, 2, 0]));
              this.position_shpere.surface = 2;
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 6) {
              this.position_shpere.surface = 2;
              const temp1 = 7 - this.position_shpere.row;
              this.position_shpere.row = temp1;
              this.position_shpere.column = 1;
              this.sphere_state = this.sphere_state.times(Mat4.translation([0, 0, 2]));
              this.camera_changed = true;
            } else if (this.position_shpere.surface == 2) {
              this.position_shpere.surface = 6;
              this.sphere_state = this.sphere_state.times(Mat4.translation([2, 0, 0]));
              const temp1 = 7 - this.position_shpere.row;
              this.position_shpere.row = temp1;
              this.position_shpere.column = 1;
              this.camera_changed = true;
            }
          }

          //enemy's turn to move
          if (this.enemy_move < 5) {
            this.enemy_state = this.enemy_state.times(Mat4.translation([0, -this.e1_move, 0]));

            if (this.e1_move > 0)
              this.position_e1.row++;
            else
              this.position_e1.row--;
            this.enemy_move++;
          } else if (this.enemy_move < 10) {
            this.enemy_state = this.enemy_state.times(Mat4.translation([-this.e1_move, 0, 0]));
            if (this.e1_move > 0)
              this.position_e1.column--;
            else
              this.position_e1.column++;
            this.enemy_move++;
          } else {
            this.enemy_move = 0;
            this.e1_move = -this.e1_move;
          }

          if (this.enemy_move % 4 == 0) {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, 0, 2]));
            this.position_e3.column_++;
          } else if (this.enemy_move % 4 == 1) {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, 2, 0]))
            this.position_e3.row--;
          } else if (this.enemy_move % 4 == 2) {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, 0, -2]));
            this.position_e3.column--;
          } else {
            this.enemy_state3 = this.enemy_state3.times(Mat4.translation([0, -2, 0]));
            this.position_e3.row++;
          }
          if (this.e2_move_count < 5) {
            this.e2_move_count++;
            this.enemy_state2 = this.enemy_state2.times(Mat4.translation([0, 0, -this.e2_move]));
            this.enemy_state5 = this.enemy_state5.times(Mat4.translation([-this.e2_move, 0, 0]));
            if (this.e2_move > 0) {
              this.position_e2.column++;
              this.position_e5.column--;
            } else {
              this.position_e2.column--;
              this.position_e5.column++;
            }
          } else {
            this.e2_move = -this.e2_move;
            this.e2_move_count = 0;
          }
        }
      }

      if (this.position_shpere.surface == 1)
        this.cat_state = this.sphere_state.times(Mat4.rotation(Math.PI / 2, Vec.of(1, 0, 0)));
      if (this.position_shpere.surface == 2)
        this.cat_state = this.sphere_state.times(Mat4.rotation(Math.PI / 2, Vec.of(0, 0, 1)));
      if (this.position_shpere.surface == 3)
        this.cat_state = this.sphere_state.times(Mat4.rotation(Math.PI / 2, Vec.of(0, 1, 0)));
      if (this.position_shpere.surface == 4)
        this.cat_state = this.sphere_state.times(Mat4.rotation(Math.PI, Vec.of(1, 0, 0)));
      if (this.position_shpere.surface == 5)
        this.cat_state = this.sphere_state.times(Mat4.rotation(Math.PI * 3 / 2, Vec.of(0, 0, 1)));

      if (this.position_shpere.surface == 6)
        this.cat_state = this.sphere_state.times(Mat4.rotation(-Math.PI / 2, Vec.of(1, 0, 0)));
      if (!this.UFO_game_over)
        this.shapes.cat.draw(graphics_state, this.cat_state, this.cat_fur);
      else {
        if (!this.cat_in_ufo) { // if cat is not in ufo
          // draw cat
          this.shapes.cat.draw(
            graphics_state,
            this.cat_state,
            this.cat_fur);
        }
      }
      //this.shapes.box.draw(graphics_state, this.sphere_state, this.plastic.override({ color: white }) );
      if (this.position_shpere.surface == 1)
        model_transform = this.sphere_state.times(Mat4.translation([0, 0, 2.5]));
      if (this.position_shpere.surface == 2)
        model_transform = this.sphere_state.times(Mat4.translation([-2.5, 0, 0]));
      if (this.position_shpere.surface == 3)
        model_transform = this.sphere_state.times(Mat4.translation([0, 2.5, 0]));
      if (this.position_shpere.surface == 4)
        model_transform = this.sphere_state.times(Mat4.translation([0, -2.5, 0]));
      if (this.position_shpere.surface == 5)
        model_transform = this.sphere_state.times(Mat4.translation([2.5, 0, 0]));
      if (this.position_shpere.surface == 6)
        model_transform = this.sphere_state.times(Mat4.translation([0, 0, -2.5]));
      //this.shapes.sphere.draw(graphics_state, model_transform, this.plastic.override({ color: white }) );

      //this.cat2_state = this.enemy_state.times(Mat4.rotation(Math.PI/2, Vec.of(1,0,0)));
      //this.shapes.cat.draw(graphics_state, this.cat2_state,this.cat_fur);
      //this.shapes.box.draw(graphics_state,this.enemy_state, this.plastic.override({ color:  yellow}));

      // model_transform = this.enemy_state.times(Mat4.translation([0,0,2.5]));

      // this.shapes.box.draw(graphics_state, this.enemy_state2, this.plastic.override({
      //   color: this.one
      // }));
      // this.shapes.box.draw(graphics_state, this.enemy_state, this.plastic.override({
      //   color: this.two
      // }));
      // this.shapes.box.draw(graphics_state, this.enemy_state3, this.plastic.override({
      //   color: this.three
      // }));
      // //this.shapes.box.draw(graphics_state, this.enemy_state4, this.plastic.override({ color: this.four}));
      // this.shapes.box.draw(graphics_state, this.enemy_state5, this.plastic.override({
      //   color: this.five
      // }));

      this.shapes.ufo.draw( // top		
        graphics_state,
        this.enemy_state.times(Mat4.translation([0, 0, 2])),
        this.ufo_texture
      );

      this.shapes.ufo.draw( // the surface close to fountain		
        graphics_state,
        this.enemy_state2.times(Mat4.translation([2, 0, 0])).times(Mat4.rotation(Math.PI / 2, Vec.of(0, 1, 0))),
        this.ufo_texture
      );

      this.shapes.ufo.draw( // opposite of emeny_state2		
        graphics_state,
        this.enemy_state3.times(Mat4.translation([-2, 0, 0])).times(Mat4.rotation(Math.PI / 2, Vec.of(0, 1, 0))),
        this.ufo_texture
      );

//       this.shapes.ufo.draw( // back		
//         graphics_state,
//         this.enemy_state4.times(Mat4.translation([0, 2, 0])).times(Mat4.rotation(Math.PI / 2, Vec.of(1, 0, 0))),
//         this.ufo_texture
//       );

      this.shapes.ufo.draw( // front		
        graphics_state,
        this.enemy_state5.times(Mat4.translation([0, -2, 0])).times(Mat4.rotation(Math.PI / 2, Vec.of(1, 0, 0))),
        this.ufo_texture
      );







      model_transform = this.enemy_state.times(Mat4.translation([0, 0, 2.5]));
      let model_transform12 = this.enemy_state4.times(Mat4.translation([0, 2.5, 0]));
      let model_transform10 = this.enemy_state2.times(Mat4.translation([2.5, 0, 0]));
      model_transform_2 = model_transform_2.times(Mat4.translation([0, 0, -100]))
        .times(Mat4.scale([102, 102, 102]));
      let model_transform11 = this.enemy_state3.times(Mat4.translation([-2.5, 0, 0]));
      let model_transform13 = this.enemy_state5.times(Mat4.translation([0, -2.5, 0]));
      // this.shapes.sphere.draw(graphics_state, model_transform, this.plastic.override({
      //   color: this.two
      // }));
      // this.shapes.sphere.draw(graphics_state, model_transform10, this.plastic.override({
      //   color: this.one
      // }));
      // this.shapes.sphere.draw(graphics_state, model_transform11, this.plastic.override({
      //   color: this.three
      // }));
      // //this.shapes.sphere.draw(graphics_state,model_transform12, this.plastic.override({ color:  this.four}));
      // this.shapes.sphere.draw(graphics_state, model_transform13, this.plastic.override({
      //   color: this.five
      // }));


      // model_transform_2 = model_transform_2.times(Mat4.translation([0,0,-100]))
      //                                    .times(Mat4.scale([102,102,102]));

      //this.shapes.sphere.draw(graphics_state,model_transform, this.plastic.override({ color:  yellow}));

      if(!this.scene1)
      this.shapes.planet_1.draw(graphics_state, this.stone_state, this.materials.planet_1);

      if(!this.scene4)
      this.shapes.planet_1.draw(graphics_state, this.chest_transform, this.materials.planet_1);

      if(!this.scene2)
      this.shapes.planet_1.draw(graphics_state, this.chest_transform1, this.materials.planet_1);
      if(!this.scene3)
      this.shapes.planet_1.draw(graphics_state, this.chest_transform2, this.materials.planet_1);

      if(!this.scene5)
      this.shapes.planet_1.draw(graphics_state, this.enemy_state4, this.materials.planet_1);
      // water ball
      //              let count = 0;
      //              if(count == 20){
      //                  model_transform_2 = model_transform_2.times( Mat4.rotation((dt*Math.PI/20), Vec.of(1,0,0)));
      //                  count = dt + count;

      //              }

      let t1 = graphics_state.animation_time / 1000;
      model_transform_2 = model_transform_2.times(Mat4.rotation((t1 * Math.PI / 20), Vec.of(1, 0, 1)));

      this.shapes.sphere.draw(graphics_state, model_transform_2, this.bump_mapped);
      model_transform_2 = Mat4.identity();
      model_transform_2 = this.draw_scene_helper(model_transform_2);
      let model_transform_3 = model_transform_2.times(Mat4.rotation(Math.PI / 2, Vec.of(1, 0.6, 0.8)))
        .times(Mat4.translation([-6 * 2 + 2 + 30, 2, 12 + 2 - 40]));
      let model_transform_4 = model_transform_2.times(Mat4.rotation(Math.PI / 2, Vec.of(1, 0.6, 0.7)))
        .times(Mat4.translation([-6 * 2 + 2 + 5, 5, 12 + 2 - 40]));
      let model_transform_5 = model_transform_2.times(Mat4.rotation(Math.PI / 2, Vec.of(0.1, 0.6, 0.9)))
        .times(Mat4.translation([-6 * 2 + 2 + 10, 20, 12 + 2 - 15]));
      let model_transform_6 = model_transform_2.times(Mat4.rotation(Math.PI / 2, Vec.of(4, 0.6, 0.7)))
        .times(Mat4.translation([-6 * 2 + 2 + 10, -1, 12 + 2]));
      let model_transform_7 = this.sphere_state.times(Mat4.translation([0, 0, 50]))
        .times(Mat4.scale([10, 10, 10]));
      this.draw_tree3(graphics_state, model_transform_3);
      model_transform_3 = model_transform_3.times(Mat4.translation([0, 2, 0]));
      model_transform_3 = model_transform_3.times(Mat4.rotation(Math.PI / 15, Vec.of(1, 0, -1)));
      model_transform_3 = model_transform_3.times(Mat4.scale([15, 1.5, 5]));
      this.shapes.terrain.draw(graphics_state, model_transform_3, this.terrain_color);
      this.draw_tree(graphics_state, model_transform_4);

      //this.shapes.terrain.draw(graphics_state, model_transform_3, this.terrain_color);
      this.draw_tree2(graphics_state, model_transform_6);

//        let model_transform_8 = Mat4.translation([20, 20, -13]).times(Mat4.scale([1, 1, 25]));
      this.shapes.cylinder.draw(graphics_state, this.tube_model_transform.times(Mat4.scale([1, 1, 25])), this.materials.fire);

      //this.shapes.sphere.draw(graphics_state, model_transform_7, this.materials.texture1);

      model_transform_6 = model_transform_6.times(Mat4.translation([0, 1, 0]));
      model_transform_6 = model_transform_6.times(Mat4.rotation(Math.PI / 60, Vec.of(1, 0, -1)));
      model_transform_6 = model_transform_6.times(Mat4.scale([12, 1.5, 5]));
      this.shapes.terrain.draw(graphics_state, model_transform_6, this.terrain_color);
      this.shapes.sphere.draw(graphics_state,model_transform_7, this.moon_bump);

      //this.graphics_state = graphics_state;
      this.finished = true;

      let model_transform_sky = Mat4.identity();
      model_transform_sky = model_transform_sky.times(Mat4.scale([300, 300, 300]));
      this.shapes.box.draw(graphics_state, model_transform_sky, this.materials.sky);

      if (this.position_shpere.row == 3 && this.position_shpere.column == 4 && this.position_shpere.surface == 1 && this.moved) {
        if (this.tree_layer_limit < 2)
          this.tree_layer_limit++;
        this.moved = false;
        this.scene1 = true;
      } else if (this.position_shpere.row == 6 && this.position_shpere.column == 1 && this.position_shpere.surface == 5) {
        
        this.tube = true;
        this.scene2 = true;
      } else if (this.position_shpere.row == 1 && this.position_shpere.column == 1 && this.position_shpere.surface == 4) {////here!!!!!
        this.moved = false;
        this.scene3 = true;
      } else if (this.position_shpere.row == 1 && this.position_shpere.column == 6 && this.position_shpere.surface == 2) {
        if (this.tree_layer_limit1 < 2)
          this.tree_layer_limit1++;
        this.moved = false;
        this.scene4 = true;

      }

      if (this.position_shpere.row == this.position_e1.row && this.position_shpere.column == this.position_e1.column && this.position_shpere.surface == this.position_e1.surface) {
        //this.game_over = true;
        this.UFO_game_over = true;
        if (!this.ufo_finished_transform)
          this.ufo_model_transform = this.enemy_state.times(Mat4.translation([-20, 0, 8]));
        this.ufo_finished_transform = true;
      }
      if (this.position_shpere.row == this.position_e2.row && this.position_shpere.column == this.position_e2.column && this.position_shpere.surface == this.position_e2.surface) {
        this.game_over = true;
      }
      if (this.position_shpere.row == this.position_e3.row && this.position_shpere.column == this.position_e3.column && this.position_shpere.surface == this.position_e3.surface) {
        this.game_over = true;
      }
      if (this.position_shpere.row == this.position_e4.row && this.position_shpere.column == this.position_e4.column && this.position_shpere.surface == this.position_e4.surface) {
        if (this.tree_layer_limit2 < 2)
          this.tree_layer_limit2++;
        this.change_board = !this.change_board;
        this.scene5 = true;
      }
      if (this.position_shpere.row == 7 && this.position_shpere.column == 2 && this.position_shpere.surface == 1) {
        this.UFO_game_over = true;

        //this.ufo_model_transform = this.cat_state.times(Mat4.translation([0,0,12]));
      }
      if (this.position_shpere.row == this.position_e5.row && this.position_shpere.column == this.position_e5.column && this.position_shpere.surface == this.position_e5.surface) {
        this.game_over = true;
      }

    }

  }

window.Ring_Shader = window.classes.Ring_Shader =
  class Ring_Shader extends Shader // Subclasses of Shader each store and manage a complete GPU program.
{
  material() {
    return {
      shader: this
    }
  } // Materials here are minimal, without any settings.
  map_attribute_name_to_buffer_name(name) // The shader will pull single entries out of the vertex arrays, by their data fields'
  { // names.  Map those names onto the arrays we'll pull them from.  This determines
    // which kinds of Shapes this Shader is compatible with.  Thanks to this function, 
    // Vertex buffers in the GPU can get their pointers matched up with pointers to 
    // attribute names in the GPU.  Shapes and Shaders can still be compatible even
    // if some vertex data feilds are unused. 
    return {
      object_space_pos: "positions"
    } [name]; // Use a simple lookup table.
  }
  // Define how to synchronize our JavaScript's variables to the GPU's:
  update_GPU(g_state, model_transform, material, gpu = this.g_addrs, gl = this.gl) {
    const proj_camera = g_state.projection_transform.times(g_state.camera_transform);
    // Send our matrices to the shader programs:
    gl.uniformMatrix4fv(gpu.model_transform_loc, false, Mat.flatten_2D_to_1D(model_transform.transposed()));
    gl.uniformMatrix4fv(gpu.projection_camera_transform_loc, false, Mat.flatten_2D_to_1D(proj_camera.transposed()));
  }
  shared_glsl_code() // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
  {
    return `precision mediump float;
              varying vec4 position;
              varying vec4 center;
      `;
  }
  vertex_glsl_code() // ********* VERTEX SHADER *********
  {
    return `
        attribute vec3 object_space_pos;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_transform;
        void main()
        { 
        gl_Position = projection_camera_transform * model_transform * vec4(object_space_pos, 1.0);
        position = model_transform * vec4(object_space_pos, 1.0);
        center = model_transform * vec4(0,0,0,1.0);
        }`; // TODO:  Complete the main function of the vertex shader (Extra Credit Part II).
  }
  fragment_glsl_code() // ********* FRAGMENT SHADER *********
  {
    return `
        void main()
        { 
          float ds = 0.0;
          ds = distance(position, center);
          gl_FragColor = vec4(0.45*(sin(ds*25.0)), 0.25*(sin(ds*25.0)), 0.2*(sin(25.0*ds)), 1.0);
        }`; // TODO:  Complete the main function of the fragment shader (Extra Credit Part II).
  }
}

window.Grid_Sphere = window.classes.Grid_Sphere =
  class Grid_Sphere extends Shape // With lattitude / longitude divisions; this means singularities are at 
{
  constructor(rows, columns, texture_range) // the mesh's top and bottom.  Subdivision_Sphere is a better alternative.
  {
    super("positions", "normals", "texture_coords");


    // TODO:  Complete the specification of a sphere with lattitude and longitude lines
    //        (Extra Credit Part III)
  }
}

class Texture_Rotate extends Phong_Shader {
  fragment_glsl_code() // ********* FRAGMENT SHADER ********* 
  {
    // TODO:  Modify the shader below (right now it's just the same fragment shader as Phong_Shader) for requirement #7.
    return `
        uniform sampler2D texture;
        void main()
        { if( GOURAUD || COLOR_NORMALS )    // Do smooth "Phong" shading unless options like "Gouraud mode" are wanted instead.
          { gl_FragColor = VERTEX_COLOR;    // Otherwise, we already have final colors to smear (interpolate) across vertices.            
            return;
          }                                 // If we get this far, calculate Smooth "Phong" Shading as opposed to Gouraud Shading.
                                            // Phong shading is not to be confused with the Phong Reflection Model.
          vec2 tex = f_tex_coord;
          float s_dist = tex.x - 0.5;
          float t_dist = tex.y - 0.5;
          tex.x = 0.5;
          tex.y = 0.5;
          float x = 3.1415926*animation_time*0.01;
          mat2 r_transform = mat2(cos(x),sin(x),-sin(x),cos(x));
          tex = tex*r_transform;
          tex.x = s_dist + tex.x;
          tex.y = t_dist + tex.y;
          vec4 tex_color = texture2D( texture, tex);                         // Sample the texture image in the correct place.
                                                                                      // Compute an initial (ambient) color:
          if( USE_TEXTURE ) gl_FragColor = vec4( ( tex_color.xyz + shapeColor.xyz ) * ambient, shapeColor.w * tex_color.w ); 
          else gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( N );                     // Compute the final color with contributions from lights.
        }`;
  }
}

class Bump_Map_Shader extends Phong_Shader {
  fragment_glsl_code() // ********* FRAGMENT SHADER ********* 
  {
    return `
        uniform sampler2D texture;
        void main()
        { if( GOURAUD || COLOR_NORMALS )    // Do smooth "Phong" shading unless options like "Gouraud mode" are wanted instead.
          { gl_FragColor = VERTEX_COLOR;    // Otherwise, we already have final colors to smear (interpolate) across vertices.            
            return;
          }                                 // If we get this far, calculate Smooth "Phong" Shading as opposed to Gouraud Shading.
                                            // Phong shading is not to be confused with the Phong Reflection Model.
          
          vec4 tex_color = texture2D( texture, f_tex_coord );                    // Use texturing as well.
          vec3 bumped_N  = normalize( N + tex_color.rgb - .5*vec3(1,1,1) );      // Slightly disturb normals based on sampling
                                                                                 // the same image that was used for texturing.
                                                                                 
                                                                                 // Compute an initial (ambient) color:
          if( USE_TEXTURE ) gl_FragColor = vec4( ( tex_color.xyz + shapeColor.xyz ) * ambient, shapeColor.w * tex_color.w ); 
          else gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( bumped_N );                    // Compute the final color with contributions from lights.
        }`;
  }
}