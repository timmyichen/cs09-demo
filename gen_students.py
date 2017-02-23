import json
from random import randint
from pprint import pprint

final = []

with open('names.txt') as f:
    class_count = 0
    classes = "ABCDE";
    for line in f:
        line = line.replace("\n","")
        s = {
            "fname":line.split(' ')[0],
            "lname":line.split(' ')[1],
            "class":classes[class_count % 5],
            "absents":randint(0,10),
            "grade":randint(40,100),
            "parent-email":"test.parent.cs09@gmail.com",
            "parent-phone":"9788355236"
        }
        class_count+=1
        final.append(s)

with open('student-data.json','w') as f:
    json.dump(final, f, sort_keys=True, indent=4, separators=(',', ': '))