

Training Piscine Python for datascience - 4 Data Oriented Design 

_Summary: Today, you will see some Structure Design. Version: 1.00_ 

|**Co**|**ntents**||
|---|---|---|
|**I**|**General rules**|**2**|
|**II**|**Specific instructions of the day**|**3**|
|**III**|**Exercise 00**|**4**|
|**IV**|**Exercise 01**|**6**|
|**V**|**Exercise 02**|**8**|
|**VI**|**Exercise 03**|**10**|
|**VII**|**Submission and peer-evaluation**|**12**|



1 

# **Chapter I** 

# **General rules** 

- You have to render your modules from a computer in the cluster either using a virtual machine: 

   - You can choose the operating system to use for your virtual machine 

   - Your virtual machine must have all the necessary software to realize your project. This software must be configured and installed. 

- Or you can use the computer directly in case the tools are available. 

   - Make sure you have the space on your session to install what you need for all the modules (use the goinfre if your campus has it) 

   - You must have everything installed before the evaluations 

- Your functions should not quit unexpectedly (segmentation fault, bus error, double free, etc) apart from undefined behaviors. If this happens, your project will be considered non functional and will receive a `0` during the evaluation. 

- We encourage you to create test programs for your project even though this work **won’t have to be submitted and won’t be graded** . It will give you a chance to easily test your work and your peers’ work. You will find those tests especially useful during your defence. Indeed, during defence, you are free to use your tests and/or the tests of the peer you are evaluating. 

- Submit your work to your assigned git repository. Only the work in the git repository will be graded. If Deepthought is assigned to grade your work, it will be done after your peer-evaluations. If an error happens in any section of your work during Deepthought’s grading, the evaluation will stop. 

- You must use the Python 3.10 version 

- Your lib imports must be explicit, for example you must "import numpy as np". Importing "from pandas import *" is not allowed, and you will get 0 on the exercise. 

- There is no global variable. 

- By Odin, by Thor ! Use your brain !!! 

2 

# **Chapter II** 

# **Specific instructions of the day** 

A common complaint to data scientists is that they write shitcode (by the way, only for educational purposes you may find a lot of examples of Python shitcode here, provided strictly for educational purposes). Why? Because the average data scientist uses a lot of inefficient techniques and hard coded variables and neglects object-oriented programming. Do not be like them. 

- No code in the global scope. Use functions! 

- Each program must have its main and not be a simple script: 

```
defmain():
#yourtestsandyourerrorhandling
if__name__=="__main__":
main()
```

- Any exception not caught will invalidate the exercices, even in the event of an error that you were asked to test. 

- You can use any built-in function if it is not prohibited in the exercise. 

- All your functions, class and method must have a documentation (__doc__) 

- Your code must be at the norm 

   - pip install flake8 

   - alias norminette=flake8 

3 

# **Chapter III Exercise 00** 

||Exercise 00|
|---|---|
|Exercice|00: Calculate my statistics|
|Turn-in directory : _ex_00_/_||
|Files to turn in : `statistics.py`||
|Allowed functions : `None`||



You must take in *args a quantity of unknown number and make the Mean, Median, Quartile (25% and 75%), Standard Deviation and Variance according to the **kwargs ask. 

You have to manage the errors. The prototype of function is: 

```
defft_statistics(*args:Any,**kwargs:Any)->None:
#yourcodehere
```

Your tester.py: 

```
fromstatisticsimportft_statistics
ft_statistics(1,42,360,11,64,toto="mean",tutu="median",tata="quartile")
print("-----")
ft_statistics(5,75,450,18,597,27474,48575,hello="std",world="var")
print("-----")
ft_statistics(5,75,450,18,597,27474,48575,ejfhhe="heheh",ejdjdejn="kdekem")
print("-----")
ft_statistics(toto="mean",tutu="median",tata="quartile")
```



<!-- Start of picture text -->
4<br><!-- End of picture text -->

Training Piscine Python for datascience - 4 

Data Oriented Design 

## Expected output: 



<!-- Start of picture text -->
$> python tester.py<br>mean : 95.6<br>median : 42<br>quartile : [11.0, 64.0]<br>-----<br>std : 17982.70124086944<br>var : 323377543.9183673<br>-----<br>-----<br>ERROR<br>ERROR<br>ERROR<br>$><br><!-- End of picture text -->



<!-- Start of picture text -->
5<br><!-- End of picture text -->

# **Chapter IV Exercise 01** 

||Exercise 01|
|---|---|
||Exercice 01: Outer_inner|
|Turn-in directory : _ex_01_/_||
|Files to turn in : `in_out.py`||
|Allowed functions : `None`||



Write a function that returns the square of argument, a function that returns the Exponentiation of argument by himself and a function that takes as argument a number and a function, it returns an object that when called returns the result of the arguments calculation. 

The prototype of functions is: 

```
defsquare(x:int|float)->int|float:
#yourcodehere
defpow(x:int|float)->int|float:
#yourcodehere
defouter(x:int|float,function)->object:
count=0
definner()->float:
#yourcodehere
```

Your tester.py: 

```
fromin_outimportouter
fromin_outimportsquare
fromin_outimportpow
my_counter=outer(3,square)
print(my_counter())
print(my_counter())
print(my_counter())
print("---")
another_counter=outer(1.5,pow)
print(another_counter())
print(another_counter())
print(another_counter())
```

6 

Training Piscine Python for datascience - 4 

Data Oriented Design 

## Expected output: 



<!-- Start of picture text -->
$> python tester.py<br>9<br>81<br>6561<br>---<br>1.8371173070873836<br>3.056683336818703<br>30.42684786675409<br>$><br><!-- End of picture text -->



```
Weremindyouthattheuseofglobalisforbidden
```

7 

# **Chapter V Exercise 02** 

Exercise 02 Exercice 02: my first decorating Turn-in directory : _ex_ 02 _<u>/</u>_ Files to turn in : `callLimit.py` Allowed functions : `None` 

Write a function that takes as argument a call limit of another function and blocks its execution above a limit. 

The prototype of functions is: 

```
defcallLimit(limit:int):
count=0
defcallLimiter(function):
deflimit_function(*args:Any,**kwds:Any):
#yourcodehere
```

Your tester.py: 

```
fromcallLimitimportcallLimit
@callLimit(3)
deff():
print("f()")
@callLimit(1)
defg():
print("g()")
foriinrange(3):
f()
g()
```

8 

Training Piscine Python for datascience - 4 

Data Oriented Design 

Expected output: 

```
$>pythontester.py
f()
g()
f()
Error:<functiongat0x7fabdc243ee0>calltoomanytimes
f()
Error:<functiongat0x7fabdc243ee0>calltoomanytimes
$>
```



<!-- Start of picture text -->
Wrappers<br><!-- End of picture text -->



<!-- Start of picture text -->
9<br><!-- End of picture text -->

# **Chapter VI Exercise 03** 



Exercise 03 

Exercice 03: data class Turn-in directory : _ex_ 03 _<u>/</u>_ Files to turn in : `new_student.py` Allowed functions : `dataclasses, random, string` 

Write a dataclass that takes as arguments a name and nickname, set active to True, create the student login, and generate a random ID with the generate_id function. You must not use __str__ , __repr__ in your class. The prototype of function and class is: 

```
importrandom
importstring
fromdataclassesimportdataclass,field
defgenerate_id()->str:
return"".join(random.choices(string.ascii_lowercase,k=15))
@dataclass
classStudent:
#yourcodehere
```

Your tester.py: 

```
fromnew_studentimportStudent
student=Student(name="Edward",surname="agle")
print(student)
```

Expected output: (id is random) 

```
$>pythontester.py
Student(name='Edward',surname='agle',active=True,login='Eagle',id='trannxhndgtolvh')
$>
```

10 

Training Piscine Python for datascience - 4 

Data Oriented Design 



```
Theloginandidshouldnotbeinitializableandmustreturnan
error.
```

## Your tester.py: 

```
fromnew_studentimportStudent
student=Student(name="Edward",surname="agle",id="toto")
print(student)
```

## Expected output: 

```
$>pythontester.py
...
TypeError:Student.__init__()gotanunexpectedkeywordargument'id'
$>
```

11 

# **Chapter VII** 

# **Submission and peer-evaluation** 

Turn in your assignment in your `Git` repository as usual. Only the work inside your repository will be evaluated during the defense. Don’t hesitate to double check the names of your folders and files to ensure they are correct. 



```
Theevaluationprocesswillhappenonthecomputeroftheevaluated
group.
```

12 

