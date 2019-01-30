
# Term project for CS 174A Fall 2018 with Professor Friedman
## Group-36

### Team members:
```
Name               UID           Email

Zhibang Chen       804783490     bang97@ucla.edu
Katherine Kang     304808025     nkang0503@g.ucla.edu
Haochen Li         204739914     joshuali1997@yahoo.com
Ziheng Xu          704756821     x15026471536@icloud.com
```
### 1. A concise description of your project - what it is, what it does.
```
This is a treasure-finding chasing game. You are a cat walking on the five surfaces of a cube floating on the water planet.

You can control the cat to walk around and collect black metal treasure. When you collect the treasure, there will be surprising scenes coming up.

You will die when an enemy treasure-guard touch you, so try to avoid the "smart" guard walking around. Each surface has a guard and they are only confined to their own surfaces.
You will also die if you touch the water (walk to the surface that's touching the water).

When you die, the cat will be transported.

```

### 2. A concise description of each member's specific contribution to the project.
```
Advanced Features:
- L-system: unique-looking trees that only grow on our planet
- Characters - obj file imported
- Bump mapping - (ugly) wasberry
- Bouncing dynamics - Physics law of inertia, velocity, acceleration
- Terrain - Water Ball with waves and grassland
- Many lights shining in a room space

Katherine Kang:
  - Contributed a firework with multi-color balls spurting out of it - texture mapping and randomness used
  - Contributed an advanced feature of bouncing dynamics (without using outside libraries)
  - Contributed a bump mapping waxberry floating in the sky
  
Haochen Li: 
  - Build the movement control of the game character.
  - Build the coordinate system of the cube. 
  - Implemented the ememy AI algorithmns in the game. 
  - Implemented the game over scene. 

Ziheng Xu: 
  - Implemented the main game scene, the cube and the planet with bump mapping and texture mapping. 
  - Imported all obj files. 
  - Created water movement and terrain. 
  - Built the many lights background with Zhibang Chen.

Zhibang Chen: 
  - Implemented L-system tree that can grow being triggered in the game scene. 
  - Built the many lights background with Ziheng Xu. 
  - Created water movement and terrain with Ziheng Xu. 

```

### 3. Details on how to both run and use/operate your project application. 
```
Just run it as all the other homework assignments.
```
