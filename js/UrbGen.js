////////////////////////////////////////////////////////////////////////////////
// URBGEN
////////////////////////////////////////////////////////////////////////////////
/**
 * Global namespace
 */
var URBGEN = URBGEN || {};
/**
 * Defines a point, specified by x, y, and z coords
 */
URBGEN.Point = function(x, y, z) {
  this.x = x;
  this.y = y;
  this.z = z;
  this.anchored = false;
  this.neighbors = [0, 0, 0, 0];
};
URBGEN.Point.prototype.setValues = function(point) {
  this.x = point.x;
  this.y = point.y;
  this.z = point.z;
};
/**
 * Defines a polygon, specified by four points.
 */
URBGEN.Poly = function(p0, p1, p2, p3) {
  this.corners = [p0, p1, p2, p3];
  this.edgeLengths = [
    URBGEN.Util.getLineSegmentLength(this.corners[0], this.corners[1]),
    URBGEN.Util.getLineSegmentLength(this.corners[1], this.corners[3]),
    URBGEN.Util.getLineSegmentLength(this.corners[0], this.corners[2]),
    URBGEN.Util.getLineSegmentLength(this.corners[2], this.corners[3])
  ];
  this.minEdgeLength;
  this.throughRoadStagger;
  this.var1;
  this.seedAngle;
  this.atomic = false;
};
/**
 * Sets this poly's corners as neighbors.
 */
URBGEN.Poly.prototype.makeSimple = function() {
  this.corners[0].neighbors[2] = this.corners[2];
  this.corners[0].neighbors[3] = this.corners[1];
  this.corners[1].neighbors[1] = this.corners[0];
  this.corners[1].neighbors[2] = this.corners[3];
  this.corners[2].neighbors[0] = this.corners[0];
  this.corners[2].neighbors[3] = this.corners[3];
  this.corners[3].neighbors[0] = this.corners[1];
  this.corners[3].neighbors[1] = this.corners[2];
};
/**
 * Defines an edge NOT TESTED MAY NOT USE
 */
URBGEN.Edge = function(points, direction) {
  this.points = points;
  this.direction = direction;
  this.angle = URBGEN.Util.getAngle(this.points[0],
    this.points[this.points.length - 1]);
};
/**
 * Constructs a city generator.
 */
URBGEN.Generator = function() {
  this.horizontalBuilder = new URBGEN.Builder.HorizontalBuilder();
  this.verticalBuilder = new URBGEN.Builder.VerticalBuilder();
  this.builder;
  this.director = new URBGEN.Builder.Director();
  this.cityPolys = [];
  this.center;
  this.initRandom();
};
/**
 * Sets up random variables
 */
URBGEN.Generator.prototype.initRandom = function() {
  this.var1 = Math.random() * 0.2 + 0.4;
  this.var2 = Math.random() * 0.2 + 0.4;
  this.blockSize = Math.random() * 15000 + 5000;
  this.width = Math.random() * 100 + 500;
  this.depth = Math.random() * 100 + 500;
  this.seedAngle = Math.random() * 0.3 + 0.1;
  this.minEdgeLength = Math.random() * 10 + 40;
  this.throughRoadStagger = Math.random() * 50;
  this.init();
};
/**
 * Sets up variables
 */
URBGEN.Generator.prototype.init = function() {
  this.cityPolys = [];
  var topLeft = new URBGEN.Point(0, 0, 0);
  var topRight = new URBGEN.Point(this.width, 0, 0);
  var bottomLeft = new URBGEN.Point(0, this.depth, 0);
  var bottomRight = new URBGEN.Point(this.width, this.depth, 0);
  var poly = new URBGEN.Poly(topLeft, topRight, bottomLeft, bottomRight);
  this.center = new URBGEN.Point(this.width / 2, this.depth / 2, 0);
  poly.makeSimple();
  this.cityPolys.push(poly);
  var polys = [poly];
};
/**
 * Generates a city.
 */
URBGEN.Generator.prototype.generate = function() {
  var newPolys = [];
  var polysDivided = false;
  for (var i = 0; i < this.cityPolys.length; i++) {
    if (URBGEN.Util.areaPoly(this.cityPolys[i]) < this.blockSize) {
      newPolys.push(this.cityPolys[i]);
    } else {
      newPolys = newPolys.concat(this.processPoly(this.cityPolys[i]));
      polysDivided = true;
    }
  }
  this.cityPolys = newPolys;
};
/**
 * Processes a polygon.
 */
URBGEN.Generator.prototype.processPoly = function(poly) {
  var length = Math.min(poly.edgeLengths[0], poly.edgeLengths[1],
    poly.edgeLengths[2], poly.edgeLengths[3]
  );
  if (length < this.minEdgeLength) {
    return [poly];
  }
  poly.minEdgeLength = this.minEdgeLength;
  poly.seedAngle = this.seedAngle;
  poly.throughRoadStagger = this.throughRoadStagger;
  poly.var1 = this.var1;
  poly.var2 = this.var2;
  this.prepare(poly);
  var newPolys = this.director.execute(this.builder, this.center);
  return newPolys;
};
/**
 *
 */
URBGEN.Generator.prototype.prepare = function(poly) {
  var horizontalSides = poly.edgeLengths[0] + poly.edgeLengths[3];
  var verticalSides = poly.edgeLengths[1] + poly.edgeLengths[2];
  if (verticalSides > horizontalSides) {
    this.builder = this.horizontalBuilder;
  } else {
    this.builder = this.verticalBuilder;
  }
  this.builder.poly = poly;
};
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// URBGEN.Builder
////////////////////////////////////////////////////////////////////////////////
/**
 * Constructs a builder
 */
URBGEN.Builder = function() {
  this.poly;
  this.origin;
  this.endPoint;
  this.newPoints;
};
/**
 * Returns an array of new polys created from this builder's current points.
 */
URBGEN.Builder.prototype.buildPolys = function() {
  var polys = [];
  for (var i = 0; i < this.newPoints.length; i++) {
    var points = this.newPoints[i];
    polys.push(new URBGEN.Poly(points[0], points[1], points[2], points[3]));
  }
  return polys;
};
/**
 * Sets the origin of the new dividing line
 */
URBGEN.Builder.prototype.setOrigin = function() {
  var var1 = this.poly.var1;
  var edgeStart = this.poly.corners[0];
  var edgeEnd = this.poly.corners[this.corners[0]];
  var origin = URBGEN.Util.linearInterpolate(edgeStart, edgeEnd, var1);
  // If the origin point is too close to the edge's start, move it
  if (Math.abs(URBGEN.Util.getLineSegmentLength(edgeStart, origin))
    < this.poly.minEdgeLength) {
      origin = URBGEN.Util.linearInterpolateByLength(edgeStart, edgeEnd,
        this.poly.minEdgeLength);
  }
  this.origin = this.addPointToPath(origin, edgeStart, edgeEnd);
};
/**
 * Sets the end point for the dividing line
 */
URBGEN.Builder.prototype.setEndPoint = function() {
  var edgeStart = this.poly.corners[this.corners[1]];
  var edgeEnd = this.poly.corners[3];
  var endPoint = URBGEN.Util.linearInterpolate(edgeStart, edgeEnd, this.poly.var2);
  this.endPoint = this.addPointToPath(endPoint, edgeStart, edgeEnd);
};
/**
 * Returns either a point on the path that lies within the distance, or the
 * original point
 */
URBGEN.Builder.prototype.addPointToPath = function(point, edgeStart, edgeEnd) {
  var path = URBGEN.Util.getDirectedPath(edgeStart, edgeEnd, this.direction);
  var distance = this.poly.throughRoadStagger;
  var nearPoint = URBGEN.Util.checkNearPoints(point, path, distance, false);
  if (nearPoint === point) {
    var neighbors = URBGEN.Util.getNeighbors(point, path);
    URBGEN.Util.insertPoint(point, neighbors.prev, neighbors.nxt);
  }
  return nearPoint;
};
/**
 * Consructs a HorizontalBuilder
 */
URBGEN.Builder.HorizontalBuilder = function() {
  URBGEN.Builder.call(this);
  this.corners = [2, 1];
  this.direction = 2;
};
/**
 * Creates a HorizontalBuilder prototype that inherits from Builder.prototype.
 */
URBGEN.Builder.HorizontalBuilder.prototype
  = Object.create(URBGEN.Builder.prototype);
/**
 * Sets the constructor to refer to HorizontalBuilder
 */
URBGEN.Builder.HorizontalBuilder.prototype.constructor
  = URBGEN.Builder.HorizontalBuilder;
/**
 * Sets this builder's current new points
 */
URBGEN.Builder.HorizontalBuilder.prototype.setNewPoints = function(data) {
  this.origin.neighbors[3] = this.endPoint;
  this.endPoint.neighbors[1] = this.origin;
  this.newPoints = [
    [this.poly.corners[0], this.poly.corners[1], this.origin, this.endPoint],
    [this.origin, this.endPoint, this.poly.corners[2], this.poly.corners[3]]
  ];
};
/**
 * Constructs a VerticalBuilder
 */
URBGEN.Builder.VerticalBuilder = function() {
  URBGEN.Builder.call(this);
  this.corners = [1, 2];
  this.direction = 3;
};
/**
 * Creates a VerticalBuilder prototype that inherits from Builder.prototype.
 */
URBGEN.Builder.VerticalBuilder.prototype
  = Object.create(URBGEN.Builder.prototype);
/**
 * Sets the constructor to refer to VerticalBuilder
 */
URBGEN.Builder.VerticalBuilder.prototype.constructor
  = URBGEN.Builder.VerticalBuilder;
/**
 * Sets this builder's current new points
 */
URBGEN.Builder.VerticalBuilder.prototype.setNewPoints = function(data) {
  this.origin.neighbors[2] = this.endPoint;
  this.endPoint.neighbors[0] = this.origin;
  this.newPoints = [
    [this.poly.corners[0], this.origin, this.poly.corners[2], this.endPoint],
    [this.origin, this.poly.corners[1], this.endPoint, this.poly.corners[3]]
  ];
};
/**
 * Constructs a director
 */
URBGEN.Builder.Director = function() {
  
};
/**
 * Invokes the builder
 */
URBGEN.Builder.Director.prototype.execute = function(builder) {
  builder.setOrigin();
  builder.setEndPoint();
  builder.setNewPoints();
  return builder.buildPolys();
};

////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// URBGEN.Util
////////////////////////////////////////////////////////////////////////////////
URBGEN.Util = {};
/**
 * Returns the length of the line segment p0p1.
 */
URBGEN.Util.getLineSegmentLength = function(p0, p1) {
  var length = Math.sqrt(Math.pow((p1.x - p0.x), 2)
    + Math.pow((p1.y - p0.y), 2));
    return length;
};
/**
 * Returns the total length of the line segments described by the path.
 */
URBGEN.Util.getPathLength = function(path) {
  var length = 0;
  for (var i = 0; i < path.points.length - 1; i++) {
    length += URBGEN.Util.getLineSegmentLength(path.points[i], path.points[i + 1]);
  }
  return length;
};
/**
 * Finds a point on the line segment p0p1 which is the specified length along
 * the line.
 */
URBGEN.Util.linearInterpolateByLength = function(p0, p1, length) {
  var totalLength = URBGEN.Util.getLineSegmentLength(p0, p1);
  if (length > totalLength) {
    return p1;
  }
  var r = length / totalLength;
  return URBGEN.Util.linearInterpolate(p0, p1, r);
};
/**
 * Finds a point on the line segment p0p1.
 */
URBGEN.Util.linearInterpolate = function(p0, p1, r) {
  var x = (1 - r) * p0.x + r * p1.x;
  var y = (1 - r) * p0.y + r * p1.y;
  var z = (1 - r) * p0.z + r * p1.z;
  return new URBGEN.Point(x, y, z);
};
/**
 * Returns the angle of the line segment p0p1 in radians
 */
URBGEN.Util.getAngle = function(p0, p1) {
  var x1 = p0.x;
  var x2 = p1.x;
  var y1 = p0.y;
  var y2 = p1.y;
  if (y1 === y2) {
    if (x2 > x1) {return 0;} else {return Math.PI;}
  }
  var angle = Math.atan2((y2 - y1), (x2 - x1));
  if (y2 > y1) {
    return angle;
    
  } else {
    return (2 * Math.PI) + angle;
  }
};
/**
 * Returns the angle of the grid axis that is closest to being perpendicular to
 * the line through p0 and p1.
 */
URBGEN.Util.getGridAngle = function(p0, p1, angle) {
  // Get the angle as a multiple of Pi adjusted to standard x y axes
  var angle = URBGEN.Util.getAngle(p0, p1) / Math.PI - angle;
  // Find which axis a line at this angle is closest to (0 or 4, 1, 2, 3)
  var axis = Math.round(angle * 2);
  // If even, the line is closest to x axis, so return the y axis of the grid
  if (axis % 2 === 0) {
    return Math.PI * (angle + 0.5);
  } else {
    return Math.PI * angle;
  }
};
/**
 * Adds the specified dA (dA * Pi) to the specified angle. The result is
 * normalized to a value between 0 and 2 * Pi radians;
 */
URBGEN.Util.addAngle = function(angle, dA) {
  var newAngle = (angle + dA * Math.PI) % (2 * Math.PI);
  if (newAngle < 0) {
    newAngle += 2 * Math.PI;
  }
  return newAngle;
  
};
/**
 * Returns a value that represents the specified point's location on the line
 * through p0 and p1, relative to the line segment p0p1.
 */
URBGEN.Util.getPointAsRatio = function(point, p0, p1) {
  var d1;
  var d2;
  // If the line is parallel with the y-axis, use the difference in y values
  if (p0.x === p1.x) {
    d1 = point.y - p0.y;
    d2 = p1.y - p0.y;
  } else { // otherwise, use the difference in x values
    d1 = point.x - p0.x;
    d2 = p1.x - p0.x;
  }
  return d1 / d2;
};
/**
 * Returns the area of the specified poly.
 */
URBGEN.Util.areaPoly = function(poly) {
  var x0 = poly.corners[3].x - poly.corners[0].x;
  var y0 = poly.corners[3].y - poly.corners[0].y;
  var x1 = poly.corners[1].x - poly.corners[2].x;
  var y1 = poly.corners[1].y - poly.corners[2].y;
  var area = Math.abs((x0 * y1 - x1 * y0) / 2);
  return area;
};
/**
 * Returns an array of points representing a path from p0 to p1 in the specified
 * direction. If p1 is not found in maxSteps iterations, returns false. If
 * maxSteps is not specified, defaults to 1000.
 */
URBGEN.Util.getDirectedPath = function(p0, p1, direction, maxSteps) {
  var points = [p0];
  var i = 0;
  while(points[i] !== p1) {
    points.push(points[i].neighbors[direction]);
    i++;
    if (i === 1000) return undefined;
  }
  return points;
};
/**
 * Returns the direction (0 - 3) in which you must travel from p0 to reach p1.
 * If p1 is not found in maxSteps (defaults to 100) iterations, returns false.
 * NOT TESTED AND NOT CURRENTLY USED
 */
URBGEN.Util.getDirection = function(p0, p1, maxSteps) {
  var points = [p0, p0, p0, p0];
  if (maxSteps === undefined) {
    maxSteps = 100;
  }
  for (var i = 0; i < maxSteps; i++) {
    for (var j = 0; j < 4; j++) {
      var point = points[j].neighbors[j];
      if (point !== 0) {
        if (point === p1) {
          return j;
        }
        points[j] = point;
      }
    }
  }
  return false;
};
/**
 * Given two lines, defined by a point on the line and the angle of the line,
 * returns the point at which the two lines intersect. If the lines are colinear,
 * returns p1.
 */
URBGEN.Util.getIntersect = function(p0, a0, p1, a1) {
  var m0 = Math.tan(a0);
  var m1 = Math.tan(a1);
  var x;
  var y;
  var point;
  // Check if the lines are colinear
  if (m0 === m1) return p0;
  // Check if either line is colinear with the y axis
  if (m0 === Infinity) {
    x = p0.x;
    y = x * m1 + (p1.y - m1 * p1.x);
  } else if (m1 === Infinity) {
    x = p1.x;
    y = x * m0 + (p0.y - m0 * p0.x);
  // Otherwise, find the intersection point
  } else {
    x = (p1.y - p0.y + (m0 * p0.x) - (m1 * p1.x)) / (m0 - m1);
    y = m1 * (x - p1.x) + p1.y;
  }
  point = new URBGEN.Point(x, y, 0);
  return point;
};
/**
 * Insets the specified poly
 */
URBGEN.Util.insetPoly = function(poly) {
  var length = 5;
  var c0 = poly.corners[0];
  var c1 = poly.corners[1];
  var c2 = poly.corners[2];
  var c3 = poly.corners[3];
  var c0c1Angle = URBGEN.Util.getAngle(c0, c1);
  var c0c2Angle = URBGEN.Util.getAngle(c0, c2);
  var c1c3Angle = URBGEN.Util.getAngle(c1, c3);
  var c2c3Angle = URBGEN.Util.getAngle(c2, c3);
  var newTopLeft = URBGEN.Util.getIntersect(
    URBGEN.Util.linearInterpolateByLength(c0, c1, length), c0c2Angle,
    URBGEN.Util.linearInterpolateByLength(c0, c2, length), c0c1Angle);
  var newTopRight = URBGEN.Util.getIntersect(
    URBGEN.Util.linearInterpolateByLength(c0, c1,
      URBGEN.Util.getLineSegmentLength(c0, c1) - length), c1c3Angle,
    URBGEN.Util.linearInterpolateByLength(c1, c3, length), c0c1Angle);
  var newBottomLeft = URBGEN.Util.getIntersect(
    URBGEN.Util.linearInterpolateByLength(c0, c2,
      URBGEN.Util.getLineSegmentLength(c0, c2) - length), c2c3Angle,
    URBGEN.Util.linearInterpolateByLength(c2, c3, length), c0c2Angle);
  var newBottomRight = URBGEN.Util.getIntersect(
    URBGEN.Util.linearInterpolateByLength(c2, c3,
      URBGEN.Util.getLineSegmentLength(c2, c3) - length), c1c3Angle,
    URBGEN.Util.linearInterpolateByLength(c1, c3,
      URBGEN.Util.getLineSegmentLength(c1, c3) - length), c2c3Angle);
  return new URBGEN.Poly(newTopLeft, newTopRight, newBottomLeft, newBottomRight);
};
/**
 * Sets the neighbor relations of p0 and p1 with the newPoint. If p0 and p1 are
 * not neighbors, returns false.
 */
URBGEN.Util.insertPoint = function(newPoint, p0, p1) {
  var direction = p0.neighbors.indexOf(p1);
  var oppDirection = (direction + 2) % 4;
  p1.neighbors[oppDirection] = newPoint;
  p0.neighbors[direction] = newPoint;
  newPoint.neighbors[direction] = p1;
  newPoint.neighbors[oppDirection] = p0;
  return true;
}
/**
 * Adds the specified point to the specified edge
 * NOT TESTED, MAY NOT USE
 */
URBGEN.Util.addPointToEdge = function(point, edge) {
  var neighbors = URBGEN.Util.getNeighbors(point, edge.points);
  var index = edge.points.indexOf(neighbors.nxt);
  edge.points.splice(index, 0, point);
  return URBGEN.Util.insertPoint(point, neighbors.prev, neighbors.nxt);
};
/**
 * Returns the specified point's neighbors among the specified points.
 */
URBGEN.Util.getNeighbors = function(point, points) {
  var neighbors = {
    prev: undefined,
    nxt: undefined
  };
  if (points.length === 2) {
    neighbors.prev = points[0];
    neighbors.nxt = points[1];
    return neighbors;
  }
  // Find the point as a ratio of the line
  var pointR = URBGEN.Util.getPointAsRatio(point, points[0],
    points[points.length - 1]);
  // if the point lies beyond either end of the path, throw error
  if (pointR <= 0 || pointR >= 1) {
    throw new Error("Can't determine neighbors. Point's r value = " + pointR);
  }
  for (var i = 1; i < points.length; i++) {
    var currPoint = points[i];
    var r = URBGEN.Util.getPointAsRatio(currPoint, points[0],
      points[points.length - 1]);
    //TODO what if r === pointR? ie, the point is identical to one on the path?
    if (r > pointR) {
      neighbors.prev = points[i - 1];
      neighbors.nxt = points[i];
      return neighbors;
    }
  }
  return false;
};
/**
 * Returns a point on the specified edge that is within the specified distance
 * of the specified point. If includeEnds is true, then the start and end points
 * of the edge will be included in the search. If no such point exists, returns
 * the original point.
 */
URBGEN.Util.checkNearPoints = function(point, points, distance, includeEnds) {
  var neighbors = URBGEN.Util.getNeighbors(point, points);
  var d0 = Math.abs(URBGEN.Util.getLineSegmentLength(neighbors.prev, point));
  var d1 = Math.abs(URBGEN.Util.getLineSegmentLength(point, neighbors.nxt));
  if (d0 < distance && d0 <= d1) {
    if (neighbors.prev === points[0]) {
      if (includeEnds) {
        return points[0];
      }
    } else {
      return neighbors.prev;
    }
  } else if (d1 < distance) {
    if (neighbors.nxt === points[points.length - 1]) {
      if (includeEnds) {
        return points[points.length - 1];
      }
    } else {
      return neighbors.nxt;
    }
  }
  return point;
};
/**
 * Returns the point in points that has the shortest straight line distance to
 * target. If any points have equal distances to target, returns the point which
 * comse first in points.
 */
URBGEN.Util.nearest = function(points, target) {
  var index = 0;
  var shortest = URBGEN.Util.getLineSegmentLength(points[0], target);
  for (var i = 1; i < points.length; i++) {
    var length = URBGEN.Util.getLineSegmentLength(points[i], target);
    if (length < shortest) {
      index = i;
      shortest = length;
    }
  }
  return points[index];
}
/**
 * Finds the population center of the specified poly, depending on the location
 * of the global city center and the city's denisty.
 */
URBGEN.Util.getPopCenter = function(poly, globalCenter, density) {
  var nearestCorner = URBGEN.Util.nearest(poly.corners, globalCenter);
  var oppositeCorner;
  for (var i = 0; i < poly.corners.length; i++) {
    if (poly.corners[i] === nearestCorner) {
      continue;
    }
    if (nearestCorner.neighbors.indexOf(poly.corners[i]) === -1) {
      oppositeCorner = poly.corners[i];
      break;
    }
  }
  var center = URBGEN.Util.linearInterpolate(nearestCorner,
    oppositeCorner, density);
  return center;
};

////////////////////////////////////////////////////////////////////////////////