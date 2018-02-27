// Module imports

const d3 = Object.assign(
  {},
  require("d3-selection"),
  require("d3-geo"),
  require("d3-geo-projection"),
  require("d3-queue"),
  require("d3-request"),
  require("d3-dispatch"),
  require("d3-collection"),
  require("d3-array"),
  // require("d3-format"),
  require("d3-transition"),
  // require("d3-ease"),
  // require("d3-zoom"),
  require("d3-timer"),
  require("d3-interpolate")
);

import * as topojson from "topojson-client";
import "url-search-params-polyfill";


if (window.URL) {
  Object.defineProperty(URL.prototype, "searchParams", {
    get: function() {
      return new URLSearchParams(this.search);
    }
  });
}

const projectionScale = new URL(window.location.href).searchParams.get('scale')
  ? new URL(window.location.href).searchParams.get("scale")
  : 180;

const translateProjectionHeightDivision = new URL(window.location.href).searchParams.get('htdiv')
  ? new URL(window.location.href).searchParams.get("htdiv")
  : 1.3;


const translateProjectionWidthDivision = new URL(window.location.href).searchParams.get('wtdiv')
  ? new URL(window.location.href).searchParams.get("wtdiv")
  : 1.8;
  

/////////////////////////
// Data handling
/////////////////////////

d3
  .queue()
  // .defer(d3.csv, "data/data.csv")
  .defer(d3.json, "data/world-50m.json")
  .defer(d3.json, "data/bornanddiedinamsterdam.geojson")
  .await(ready);

// Start queue data callback function
function ready(error, worldCountries, bornAndDied) {
  if (error) return console.log(`error: ${error.responseText}`);


  // Filter out bad years
  bornAndDied.features = bornAndDied.features.filter(
    e =>
      e.properties.Geboortejaar != "" &&
      e.properties.Sterftejaar != "" &&
      e.properties.Sterftejaar.length < 5
  );
  
  // Building an array with target names
  const yearsList = d3
    .map(bornAndDied.features, d => +d.properties.Sterftejaar)
    .keys()
    .sort();

  function yearOfDeathFinder(object, year) {
    return object.features.filter(e => e.properties.Sterftejaar === year);
  }

  ///////////////////////////
  // Visualization building
  //////////////////////////

  const width = 960;
  const height = 500;

  // general svg object
  const svg3 = d3
    .select("body")
    .select("#graph")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // map projection
  const projection = d3
    .geoMercator()
    .scale(projectionScale)
    // .scale(1100)
    // .rotate([0, -10])
    .translate([width / translateProjectionWidthDivision, height / translateProjectionHeightDivision])
    // .translate([width / 2, height + 800])
    .precision(0.1);

  const geo_path = d3.geoPath().projection(projection);

  // draw world map land
  svg3
    .append("path")
    .datum(topojson.feature(worldCountries, worldCountries.objects.land))
    .attr("d", geo_path)
    .attr("class", "land");

  // draw border boundaries
  svg3
    .append("path")
    .datum(
      topojson.mesh(
        worldCountries,
        worldCountries.objects.countries,
        (a, b) => a !== b && ((a.id / 1000) | 0) === ((b.id / 1000) | 0)
      )
    )
    .attr("d", geo_path)
    .attr("class", "boundary");

  // helper to create a curved path from linestrings according to projection
  const path = d3
    .geoPath()
    .projection(projection)
    .pointRadius(2.5);

  const arcs = svg3.selectAll(".arcs");

  arcs
    .data(yearOfDeathFinder(bornAndDied, yearsList[0]))
    .enter()
    .append("g")
    .attr("class", "arcs")
    .append("path")
    .attr("class", d => (d.properties.Categorie == "Naar Amsterdam gekomen" ? "arc-to" : "arc-from"))
    .attr("d", d => path(d))
    .transition()
    .duration(1000)
    .attrTween("stroke-dasharray", function() {
      const len = this.getTotalLength();
      return t => d3.interpolate(`0,${len}`, `${len},0`)(t);
    })
    .attr("opacity", 1)
    .transition()
    .duration(2000)
    .attr("opacity", 0);

  d3
    .select("#counter")
    .append("p")
    .text(+d3.min(yearsList));




  let intervalIndex = 0;

  const interval = d3.interval(function(elapsed) {
    // stop interval when the last year in the array has been reached
    if (yearsList[intervalIndex] == +d3.max(yearsList)) {
      interval.stop(); // <== !!!
    }

    d3
      .select("body")
      .selectAll("svg")
      .selectAll(".arcs")
      .data(yearOfDeathFinder(bornAndDied, yearsList[intervalIndex]))
      .enter()
      .selectAll(".arcs")
      .insert("path")
      .attr("class", d => (d.properties.Categorie == "Naar Amsterdam gekomen" ? "arc-to" : "arc-from"))
      .attr("d", d => path(d))
      .transition()
      .duration(1000)
      .attrTween("stroke-dasharray", function() {
        const len = this.getTotalLength();
        return t => d3.interpolate(`0,${len}`, `${len},0`)(t);
      })
      .attr("opacity", 1)
      .transition()
      .duration(2000)
      .attr("opacity", 0);

    d3
      .select("#counter")
      .select("p")
      .remove();
    d3
      .select("#counter")
      .append("p")
      .text(yearsList[intervalIndex]);

    intervalIndex++;
  }, 20);
}
