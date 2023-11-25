# particle-sorting-demo

Demo comparing sorting approaches including native Array.sort, three.js' Hybrid Radix sort, and a spatial-query-based sort using three-mesh-bvh. The BVH-based sort is performed by traversing the BVH depth first, furthest bounding node to closest and filling up the sorted buffer during traversal. The order between the two child bounds is determined by the side of the split plane the camera is on.

Demo [here](https://gkjohnson.github.io/particle-sorting-demo/).



**TODO**

- Add parallel sort
