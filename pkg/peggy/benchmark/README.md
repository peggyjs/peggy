Peggy Benchmark Suite
======================

This is the Peggy benchmark suite. It measures speed of the parsers generated
by Peggy on various inputs. Its main goal is to provide data for code generator
optimizations.

Running in Node.js
------------------

All commands in the following steps need to be executed in Peggy root directory
(one level up from this one).

  1. Install all Peggy dependencies, including development ones:

     ```console
     $ npm install
     ```

  2. Execute the benchmark suite:

     ```console
     $ npm run benchmark
     ```

  3. Wait for results.

Running in the Browser
----------------------

All commands in the following steps need to be executed in Peggy root directory
(one level up from this one).

  1. Make sure you have Node.js installed.

  2. Install all Peggy dependencies, including development ones:

     ```console
     $ npm install
     ```

  3. Serve the benchmark suite using a web server:

     ```console
     $ benchmark/server
     ```

  4. Point your browser to the [benchmark suite](http://localhost:8000/).

  5. Click the **Run** button and wait for results.
