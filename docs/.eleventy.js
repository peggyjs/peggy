module.exports = function (eleventyConfig) {
  // Copy assets to the output directory as-is
  eleventyConfig.addPassthroughCopy("img");
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy("vendor");
  eleventyConfig.addPassthroughCopy("favicon.ico");

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
