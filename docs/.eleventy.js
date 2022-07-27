module.exports = function (eleventyConfig) {
  // Copy assets to the output directory as-is
  eleventyConfig.addPassthroughCopy("img");
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy("vendor");
  eleventyConfig.addPassthroughCopy("favicon.ico");

  eleventyConfig.setServerOptions({
    // Opt-out of the live reload snippet
    enabled: true,
    // Opt-out of DOM diffing updates and use page reloads
    domdiff: true,
    // The starting port number to attempt to use
    port: 8080,
    // Show the server version number on the command line
    showVersion: true,
  });

  return {
    // Control which files Eleventy will process
    // e.g.: *.md, *.njk, *.html, *.liquid
    templateFormats: ["html", "njk", "liquid", "md"],
    // Path prefix for URLs
    pathPrefix: "/",
    // Config for input/output/data/etc. directories
    dir: {
      input: ".",
      output: "_site",
    },
  };
};
