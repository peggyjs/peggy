literal = match:"foo" rest:rest { return {match, rest}; }

literal_i = match:"foo"i rest:rest { return {match, rest}; }

any = match:. rest:rest { return {match, rest}; }

class = match:[a-z] rest:rest { return {match, rest}; }

not_class_i = match:[^a-z]i rest:rest { return {match, rest}; }

rule = match:child rest:rest { return {match, rest}; }; child = "foo"

paren = match:("1" { return 2; })+ rest:rest { return {match, rest}; }

paren_pluck = match:(@[0-9] ",")+ rest:rest { return {match, rest}; }

star = match:"a"* rest:rest { return {match, rest}; }

plus = match:"a"+ rest:rest { return {match, rest}; }

repetition = match:"a"|2..3, ","| rest:rest { return {match, rest}; }

maybe = match:"a"? rest:rest { return {match, rest}; }

posAssertion = match:"a" &"b" rest:rest { return {match, rest}; }

negAssertion = match:"a" !"b" rest:rest { return {match, rest}; }

posPredicate = match:(@num:$[0-9]+ &{ return parseInt(num, 10) < 100 }) rest:rest { return {match, rest}; }

negPredicate = match:(@num:$[0-9]+ !{ return parseInt(num, 10) < 100 }) rest:rest { return {match, rest}; }

dollar = match:$"a"+ rest:rest { return {match, rest}; }

label = match:(foo:"bar"i { return {foo}; }) rest:rest { return {match, rest}; }

pluck_1 = match:(@$"a"+ " "+ @$"b"+) rest:rest { return {match, rest}; }

pluck_2 = match:(@$"a"+ " "+ @two:$"b"+ &{ return two.length < 3 }) rest:rest { return {match, rest}; }

sequence = match:("a" "b" "c") rest:rest { return {match, rest}; }

action = match:(" "+ "a" { return location(); }) rest:rest { return {match, rest}; }

alt = match:("a" / "b" / "c") rest:rest { return {match, rest}; }

rest "The rest of the input" = $.*
