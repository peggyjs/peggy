Entry 
 = File / Directory

File 
 = "file"

Directory 
 = "directory" _
   ":" _ 
   Map<name,Entry>

Map<Key,Value> 
 = "{" _
    head:(@MapEntry<Key,Value> _)?
    tail:("," _ @MapEntry<Key,Value> _)*
   "}"

MapEntry<Key,Value>
 = Key _ ":" _ Value

name = [a-zA-Z0-9]+

_ "whitespace"
  = [ \t\n\r]*

