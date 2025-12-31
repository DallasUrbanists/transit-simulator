# Transit Simulator (BETA)

Try it live now: [https://dallasurbanists.github.io/transit-simulator/](https://dallasurbanists.github.io/transit-simulator/)

<img width="1920" height="1199" alt="image" src="https://github.com/user-attachments/assets/916dce1e-4fad-4dd4-a9f4-09aa7fe6700e" />

This simulator visualizes all fixed modes of transit (local bus, express bus, shuttle bus, trolley, streetcar, light rail, and commuter rail) in the network of the following transit agencies:
* Dallas Area Rapid Transit (DART)
* McKinney Avenue Transit Authority (MATA)
* Trinity Metro
* Denton County Transit Authority (DCTA)

My goal with this project is to provide a visual aid for educators, advocates, policy makers, planners, content creators... anyone who ever finds themselves needing to explain anything about how public transit works. Before this tool, there were very little options for creating engaging animated visuals of public transit. The idea is that anyone can use this tool to showcase the transportation options availabe in a certain area, and use the screen-recording functionality on their smartphone or computer to produce shareable videos.

## Setting up Local Development
1. Confirm that you have node installed. `node -v`
2. Run `npm install` to install the needed packages
3. Visit (Maptiler.com)[https://www.maptiler.com/] to create a free account, and copy that API key.
4. If you intend to use (Transitland)[https://www.transit.land/], they also have a free tier. Create a free account there as well.
5. Save both the API keys to `\.env`, following the template from `.env.example`
6. Run `npm run dev` to enable hot reloads. Now saving your changes to any file will automatically load those changes.

## Current Features
* Play/pause based on actual transit schedules (not real-time). Press spacebar to toggle playback.
* Click-and-drag to scrub timeline.
* Pan/zoom map to any real-world location.
* Adjust playback speed, from 1x to 2048x.
* Swap map themes [from MapTiler](https://cloud.maptiler.com/maps/), including light, dark, and satellite modes.
* Adjust clock size, position, and color (light/dark).
* Continuous loop: the program currently only follows weekday schedules. After midnight, the system easily handles overnight trips. It is possible to leave the simulation running non-stop.
* Fullscreen mode: ready to be presented on a big screen! Maybe your next screensaver?
* Settings remembered on local device between sessions.

## Known Issues
* Bus tails not working specifically for DCTA vehicles.
* Movement of DCTA buses looks suspicious...
* Routes that either form a closed loop, or involve a loop at some point in their jounry, tend to have buggy wayfinding. Most noticeable example is Route 28 in West Dallas, when it approaches Singleton/Bernal Transfer Center.
* Clock not repositionable on mobile.
* Page size, map panning and zooming can get clunky on mobile.
* Control UI could use an overall facelift.

## Future Features
Here is my wishlist for features I'd like to see in the future.
* More public transit agencies
* Support for private intercity providers (Amtrak, Flixbus/Greyhound)
* Type to search address or location.
* More run-time customizability: colors, fonts, tail lengths, tail colors, custom markers, etc.
* Toggle on/off specific agencies, routes, modes, and trips
* Choose simulation day of week, like Saturday or Sunday.
* Choose specific dates for simulation, such as December 25. Can be especially useful for visiualizing special service around major upcoming events, like the State Fair, or the World Cup.
* Toggle overlays for micro-transit/on-demand zones.
* Place custom map markers and overlays for content creation.
* Visualize detours and theoretical alternate routes.
* Visualize bicycle infrastructure and interfaces between transit and cycling.
* Overlay typical traffic conditions by hour to showcase times of day when transit is preferrable over driving.
* Click to view details about stops, stations, transit centers: connecting routes, on-demand zones, handicap accessibility, cycling infrastructure, micro-mobility options (e.g. Lime Scooter availability), park-and-ride availability, nearby amenities, etc.
* Click to view details about route.
* Click to view details about neighborhood.
* Export and download video (i.e. removing the need for a separate screen-recording app).
* Suite of animation tools, e.g. adding keyframes for panning and flying between locations; highlighting specific routes while fading or hiding others; apply green screen map tiles for composing animation over other footage; etc.
