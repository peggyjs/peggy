$(document).ready(function() {
  var KB      = 1024;
  var MS_IN_S = 1000;

  var parser;
  var parserSource       = null;

  var editor = CodeMirror.fromTextArea($("#grammar").get(0), {
      lineNumbers: true,
      mode: "pegjs",
      gutters: ["CodeMirror-lint-markers"],
      lint: true,
  });
  var input = CodeMirror.fromTextArea($("#input").get(0), {
      lineNumbers: true,
      mode: null,
      gutters: ["CodeMirror-lint-markers"],
      lint: true,
  });

  CodeMirror.registerHelper("lint", "pegjs", function(grammar) {
    var problems = [];
    buildAndParse(grammar, problems);
    return problems;
  });

  CodeMirror.registerHelper("lint", null, function(content) {
    var problems = [];
    parse(content, problems);
    return problems;
  });

  function convertLocation(location) {
    return CodeMirror.Pos(location.line - 1, location.column - 1);
  }

  function convertError(e, problems) {
    if (e.location !== undefined) {
      problems.push({
        severity: "error",
        message: e.message,
        from: convertLocation(e.location.start),
        to:   convertLocation(e.location.end),
      });
    } else {
      problems.push({
        severity: "error",
        message: e.message,
      });
    }
    if (e.diagnostics !== undefined) {
      for (var i = 0; i < e.diagnostics.length; ++i) {
        var d = e.diagnostics[i];
        problems.push({
          severity: "warning",
          message: d.message,
          from: convertLocation(d.location.start),
          to:   convertLocation(d.location.end),
        });
      }
    }
  }

  function buildSizeAndTimeInfoHtml(title, size, time) {
    return $("<span/>", {
      "class": "size-and-time",
      title:   title,
      html:    (size / KB).toPrecision(2) + "&nbsp;kB, "
                 + time + "&nbsp;ms, "
                 + ((size / KB) / (time / MS_IN_S)).toPrecision(2) + "&nbsp;kB/s"
    });
  }

  function buildErrorMessage(e) {
    return e.location !== undefined
      ? "Line " + e.location.start.line + ", column " + e.location.start.column + ": " + e.message
      : e.message;
  }

  /**
   * Generates code from the parser, collects problems in `problems` in CodeMirror
   * lint format.
   *
   * @param {string} grammar Grammar text
   * @param {CodeMirror.lint.Annotation[]} problems List of problems of current
   *        grammar that editor should show
   * @returns {string} Source code of the parser
   */
  function build(grammar, problems) {
    $('#build-message').attr("class", "message progress").text("Building the parser...");
    $("#input").attr("disabled", "disabled");
    $("#parse-message").attr("class", "message disabled").text("Parser not available.");
    $("#output").addClass("disabled").text("Output not available.");
    $("#parser-var").attr("disabled", "disabled");
    $("#option-cache").attr("disabled", "disabled");
    $("#parser-download").attr("disabled", "disabled");

    try {
      var timeBefore = (new Date).getTime();
      parserSource = peggy.generate(grammar, {
        cache:    $("#option-cache").is(":checked"),
        output:   "source",

        error: function(_stage, message, location) {
          problems.push({
            severity: "error",
            message: message,
            from: convertLocation(location.start),
            to:   convertLocation(location.end),
          });
        },
        warn: function(_stage, message, location) {
          problems.push({
            severity: "warning",
            message: message,
            from: convertLocation(location.start),
            to:   convertLocation(location.end),
          });
        },
      });
      var timeAfter = (new Date).getTime();

      parser = eval(parserSource);

      $("#build-message")
        .attr("class", "message info")
        .html("Parser built successfully.")
        .append(buildSizeAndTimeInfoHtml(
          "Parser build time and speed",
          grammar.length,
          timeAfter - timeBefore
        ));
      $("#input").removeAttr("disabled");
      $("#parser-var").removeAttr("disabled");
      $("#option-cache").removeAttr("disabled");
      $("#parser-download").removeAttr("disabled");

      var result = true;
    } catch (e) {
      convertError(e, problems);
      $("#build-message").attr("class", "message error").text(buildErrorMessage(e));

      var result = false;
    }

    doLayout();
    return result;
  }

  function parse(newInput, problems) {
    $("#input").removeAttr("disabled");
    $("#parse-message").attr("class", "message progress").text("Parsing the input...");
    $("#output").addClass("disabled").text("Output not available.");

    try {
      var timeBefore = (new Date).getTime();
      var output = parser.parse(newInput);
      var timeAfter = (new Date).getTime();

      $("#parse-message")
        .attr("class", "message info")
        .text("Input parsed successfully.")
        .append(buildSizeAndTimeInfoHtml(
          "Parsing time and speed",
          newInput.length,
          timeAfter - timeBefore
        ));
      $("#output").removeClass("disabled").html(util.inspect(output, {
        depth: Infinity,
        color: false,
        maxArrayLength: Infinity,
        maxStringLength: Infinity,
        compact: false,
        stylize: util.stylizeWithHTML,
      }));

      var result = true;
    } catch (e) {
      convertError(e, problems);
      $("#parse-message").attr("class", "message error").text(buildErrorMessage(e));

      var result = false;
    }

    doLayout();
    return result;
  }

  function buildAndParse(grammar, problems) {
    build(grammar, problems) && parse(input.getValue(), []);
  }

  function rebuildGrammar() {
    buildAndParse(editor.getValue(), []);
  }

  function doLayout() {
    var editors = $(".CodeMirror");
    /*
     * This forces layout of the page so that the |#columns| table gets a chance
     * make itself smaller when the browser window shrinks.
     */
    $("#left-column").height("0px");    // needed for IE
    $("#right-column").height("0px");   // needed for IE
    for (var i = 0; i < editors.length; ++i) {
      $(editors[i]).height("0px");
    }

    $("#left-column").height(($("#left-column").parent().innerHeight() - 2) + "px");     // needed for IE
    $("#right-column").height(($("#right-column").parent().innerHeight() - 2) + "px");   // needed for IE
    for (var i = 0; i < editors.length; ++i) {
      $(editors[i]).height(($(editors[i]).parent().parent().innerHeight() - 14) + "px");
    }
  }

  $("#parser-var, #option-cache")
    .change(rebuildGrammar)
    .mousedown(rebuildGrammar)
    .mouseup(rebuildGrammar)
    .click(rebuildGrammar)
    .keydown(rebuildGrammar)
    .keyup(rebuildGrammar)
    .keypress(rebuildGrammar);

  $( "#parser-download" )
    .click(function(){

      var blob = new Blob( [$( "#parser-var" ).val() + " = " + parserSource + ";\n"], {type: "application/javascript"} );
      window.saveAs( blob, "parser.js" );

    });

  doLayout();
  $(window).resize(doLayout);

  $("#loader").hide();
  $("#content").show();

  $("#grammar, #parser-var, #option-cache").removeAttr("disabled");

  rebuildGrammar();

  editor.refresh();
  editor.focus();
  input.refresh();
});
