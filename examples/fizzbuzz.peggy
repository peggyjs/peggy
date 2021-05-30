/*
This grammar aims to have one of every Peggy syntax.
It parses the output of a fizz-buzz (https://en.wikipedia.org/wiki/Fizz_buzz)
program (plus a few extensions) for correctness.
*/
{{
const NUMS = [3, 5];
}}
{
let currentNumber = (options.start == null) ? 1 : options.start|0;
}

top = c:count* { return c.filter(fb => fb) }

count
  = end_comment "\n" { return }
  / comment "\n" { return }
  / comment? fb:line (comment / end_comment)? "\n" {
    currentNumber++;
    return fb;
  }

comment "comment"
  = _ "/*" (!"*/" .)* "*/" _

end_comment
  = _ "//" [^\n]+

line
  = @n:number &{ return (n === currentNumber) && NUMS.every(d => n % d) }
  / fizzbuzz
  / fizz
  / buzz

fizzbuzz = f:fizz _ b:buzz { return f + b }
fizz = @"fizz"i !{ return currentNumber % 3 }
buzz = @"buzz"i !{ return currentNumber % 5 }

// Arbitrary requirement needing &
number "number without trailing comment"
  = "0x" n:$[0-9a-f]i+ &"\n" { return parseInt(n, 16) }
  / n:$[0-9]+ &"\n" { return parseInt(n, 10) }

_ = $[ \t]*
