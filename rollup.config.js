
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs    from 'rollup-plugin-commonjs';





const umd_config = {

  onwarn: function (message) {
    if (message.code === 'EVAL') { return; }
    console.error(message);
  },

  input: 'build/ts/peg.js',

  output: {
    file   : 'build/rollup/peg.umd.js',
    format : 'umd',
    name   : 'peg'
  },

  plugins : [

    nodeResolve({
      mainFields     : ['module', 'main'],
      browser        : true,
      extensions     : [ '.js', '.json', '.ts', '.tsx' ],
      preferBuiltins : false
    }),

    commonjs()

  ]

};





const es6_config = {

  onwarn: function (message) {
    if (message.code === 'EVAL') { return; }
    console.error(message);
  },

  input: 'build/ts/peg.js',

  output: {
    file   : 'build/rollup/peg.esmodule.js',
    format : 'es',
    name   : 'peg'
  },

  plugins : [

    nodeResolve({
      mainFields     : ['module', 'main'],
      browser        : true,
      extensions     : [ '.js', '.json', '.ts', '.tsx' ],
      preferBuiltins : false
    }),

    commonjs()

  ]

};





export default [ umd_config, es6_config ];
