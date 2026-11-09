

# Libft 

Your very first own library 

_Summary: This project involves coding a_ _`C` library that will include numerous general purpose functions for your programs._ 

_Version: 19.2_ 

# **Contents** 

|**I**|**Introduction**|**2**|
|---|---|---|
|**II**|**Common Instructions**|**3**|
|**III**|**AI Instructions**|**5**|
|**IV**|**Mandatory part**|**7**|
|IV|.1<br>Technical considerations . . . . . . . . . . . . . . . .|. . . . . . . . . .<br>7|
|IV|.2<br>Part 1 - Libc functions<br>. . . . . . . . . . . . . . . .|. . . . . . . . . .<br>8|
|IV|.3<br>Part 2 - Additional functions . . . . . . . . . . . . .|. . . . . . . . . .<br>10|
|IV|.4<br>Part 3 - linked list . . . . . . . . . . . . . . . . . . .|. . . . . . . . . .<br>14|
|**V**|**Readme Requirements**|**17**|
|**VI**|**Submission and peer-evaluation**|**18**|



1 

# **Chapter I** 

# **Introduction** 

`C` programming can be quite tedious without access to the highly useful standard functions. This project aims to help you understand how these functions work by implementing them yourself and learning to use them effectively. You will create your own library, which will be valuable for your future `C` school assignments. 

2 

# **Chapter II** 

# **Common Instructions** 

- Your project must be written in C. 

- Your project must be written in accordance with the Norm. If you have bonus files/functions, they are included in the norm check, and you will receive a `0` if there is a norm error. 

- Your functions should not quit unexpectedly (segmentation fault, bus error, double free, etc.) except for undefined behavior. If this occurs, your project will be considered non-functional and will receive a `0` during the evaluation. 

- All heap-allocated memory must be properly freed when necessary. Memory leaks will not be tolerated. 

- If the subject requires it, you must submit a `Makefile` that compiles your source files to the required output with the flags `-Wall` , `-Wextra` , and `-Werror` , using `cc` . Additionally, your `Makefile` must not perform unnecessary relinking. 

- Your `Makefile` must contain at least the rules `$(NAME)` , `all` , `clean` , `fclean` and `re` . 

- To submit bonuses for your project, you must include a `bonus` rule in your `Makefile` , which will add all the various headers, libraries, or functions that are not allowed in the main part of the project. Bonuses must be placed in `_bonus.{c/h}` files, unless the subject specifies otherwise. The evaluation of mandatory and bonus parts is conducted separately. 

- If your project allows you to use your `libft` , you must copy its sources and its associated `Makefile` into a `libft` folder. Your project’s `Makefile` must compile the library by using its `Makefile` , then compile the project. 

- We encourage you to create test programs for your project, even though this work **does not need to be submitted and will not be graded** . It will give you an opportunity to easily test your work and your peers’ work. You will find these tests especially useful during your defence. Indeed, during defence, you are free to use your tests and/or the tests of the peer you are evaluating. 

- Submit your work to the assigned Git repository. Only the work in the Git repository will be graded. If Deepthought is assigned to grade your work, it will occur 

3 

Libft 

Your very first own library 

after your peer-evaluations. If an error happens in any section of your work during Deepthought’s grading, the evaluation will stop. 



<!-- Start of picture text -->
4<br><!-- End of picture text -->

# **Chapter III** 

# **AI Instructions** 

## ● **Context** 

This project is designed to help you discover the fundamental building blocks of your 42 training. 

To properly anchor key knowledge and skills, it’s essential to adopt a thoughtful approach to using AI tools and support. 

True foundational learning requires genuine intellectual effort — through challenge, repetition, and peer-learning exchanges. 

For a more complete overview of our stance on AI — as a learning tool, as part of the 42 training, and as an expectation in the job market — please refer to the dedicated FAQ on the intranet. 

## ● **Main message** 

- ☛ Build strong foundations without shortcuts. 

- ☛ Really develop tech & power skills. 

- ☛ Experience real peer-learning, start learning how to learn and solve new problems. 

- ☛ The learning journey is more important than the result. 

- ☛ Learn about the risks associated with AI, and develop effective control practices and countermeasures to avoid common pitfalls. 

## ● **Learner rules:** 

- You should apply reasoning to your assigned tasks, especially before turning to AI. 

5 

Libft 

Your very first own library 

- You should not ask for direct answers to the AI. 

- You should learn about 42 global approach on AI. 

## ● **Phase outcomes:** 

Within this foundational phase, you will get the following outcomes: 

- Get proper tech and coding foundations. 

- Know why and how AI can be dangerous during this phase. 

## ● **Comments and example:** 

- Yes, we know AI exists — and yes, it can solve your projects. But you’re here to learn, not to prove that AI has learned. Don’t waste your time (or ours) just to demonstrate that AI can solve the given problem. 

- Learning at 42 isn’t about knowing the answer — it’s about developing the ability to find one. AI gives you the answer directly, but that prevents you from building your own reasoning. And reasoning takes time, effort, and involves failure. The path to success is not supposed to be easy. 

- Keep in mind that during exams, AI is not available — no internet, no smartphones, etc. You’ll quickly realise if you’ve relied too heavily on AI in your learning process. 

- Peer learning exposes you to different ideas and approaches, improving your interpersonal skills and your ability to think divergently. That’s far more valuable than just chatting with a bot. So don’t be shy — talk, ask questions, and learn together! 

- Yes, AI will be part of the curriculum — both as a learning tool and as a topic in itself. You’ll even have the chance to build your own AI software. In order to learn more about our crescendo approach you’ll go through in the documentation available on the intranet. 

### ✓ **Good practice:** 

I’m stuck on a new concept. I ask someone nearby how they approached it. We talk for 10 minutes — and suddenly it clicks. I get it. 

### ✗ **Bad practice:** 

I secretly use AI, copy some code that looks right. During peer evaluation, I can’t explain anything. I fail. During the exam — no AI — I’m stuck again. I fail. 

6 

# **Chapter IV** 

# **Mandatory part** 

|**Program Name**|`libft.a`|
|---|---|
|**Files to Submit**|`Makefile, libft.h, ft_*.c`|
|**Makefile**|`NAME, all, clean, fclean, re`|
|**External Function**|`Detailed below`|
|**Libft authorized**|`n/a`|
|**Description**|`Create your own library:`<br>`a collection of functions`<br>`that will be a useful tool for your curriculum.`|



## **IV.1 Technical considerations** 

- Declaring global variables is strictly forbidden. 

- If you need helper functions to break down a more complex function, define them as `static` functions to restrict their scope to the appropriate file. 

- All files must be placed at the root of your repository. 

- Submitting unused files is not allowed. 

- Every `.c` file must compile with the following flags: `-Wall -Wextra -Werror` . 

- You must use the `ar` command to create your library. The use of `libtool` is strictly forbidden. 

- Your `libft.a` must be created at the root of your repository. 

7 

Libft 

Your very first own library 

## **IV.2 Part 1 - Libc functions** 

To begin, you must reimplement a set of functions from the `libc` . Your version will have the same prototypes and behaviors as the originals, adhering strictly to their definitions in the `man` page. The only difference will be their names, which must start with the ’ `ft_` ’ prefix. For example, `strlen` becomes `ft_strlen` . 



```
Someofthefunctionprototypesyouneedtoreimplementusethe
’restrict’qualifier.ThiskeywordispartoftheC99standard.
Therefore,itisforbiddentoincludeitinyourownprototypesand
tocompileyourcodewiththe-std=c99flag.
```

You must write your own functions that implement the following originals. They must not rely on any external functions. 



```
Forthecharacterclassificationfunctions(isalpha,isdigit,
isalnum,isascii,isprint),thereturnvaluemustbe:
```

   - `1 if the character matches the tested class` 

   - `0 if the character does not match` 

- `isalpha` 

- `isdigit` 

- `isalnum` 

- `isascii` 

- `memcpy` 

- `memmove` 

- `strlcpy` 

      - `strrchr` 

      - `strncmp` 

      - `memchr` 

   - `strlcat` 

- `isprint` 

   - `memcmp` 

- `toupper` 

- _•_ `strlen` 

- `tolower` 

- _•_ `memset` 

   - `strnstr` 

- `bzero` _•_ `strchr` 

- `atoi` 

In order to implement the two following functions, you will use `malloc()` : 

- `calloc` _•_ `strdup` 



```
Dependingonyourcurrentoperatingsystem,the’calloc’function’s
behaviormaydifferfromitsmanpagedescription.Youmustfollow
thisrule:Ifnmemborsizeis0,thencalloc()returnsaunique
pointervaluethatcanbesuccessfullypassedtofree().
```

8 

Libft 

Your very first own library 



```
Somefunctionsthatyoumustreimplement,suchasstrlcpy,strlcat,
andbzero,arenotincludedbydefaultintheGNUCLibrary(glibc).
Totestthemagainstthesystemstandard,youmayneedtoinclude
<bsd/string.h>andcompilewiththe-lbsdflag.
Thisbehaviourisspecifictoglibcsystems.Ifyouarecurious,
taketheopportunitytoexplorethedifferencesbetweenglibcandBSD
libc.
```



<!-- Start of picture text -->
9<br><!-- End of picture text -->

Libft 

Your very first own library 

## **IV.3 Part 2 - Additional functions** 

In this second part, you must develop a set of functions that are either not included in the `libc` , or exist in a different form. 



```
SomeofthefunctionsfromPart1maybeusefulforimplementingthe
functionsbelow.
```

|**Function Name**|`ft_substr`|
|---|---|
|**Prototype**|`char *ft_substr(char const *s, unsigned int start,`<br>`size_t len);`|
|**Files to Submit**|`-`|
|**Parameters**|`s:`<br>`The original string from which to create the`<br>`substring.`<br>`start:`<br>`The starting index of the substring within`<br>`’s’.`<br>`len:`<br>`The maximum length of the substring.`|
|**Return Value**|`The substring.`<br>`NULL if the allocation fails.`|
|**External Function**|`malloc`|
|**Description**|`Allocates memory (using malloc(3)) and returns a`<br>`substring from the string ’s’.`<br>`The substring starts at index ’start’ and has a`<br>`maximum length of ’len’.`|



|**Function Name**|`ft_strjoin`|
|---|---|
|**Prototype**|`char *ft_strjoin(char const *s1, char const *s2);`|
|**Files to Submit**|`-`|
|**Parameters**|`s1:`<br>`The prefix string.`<br>`s2:`<br>`The suffix string.`|
|**Return Value**|`The new string.`<br>`NULL if the allocation fails.`|
|**External Function**|`malloc`|
|**Description**|`Allocates memory (using malloc(3)) and returns a`<br>`new string, which is the result of concatenating`<br>`’s1’ and ’s2’.`|



10 

Libft 

Your very first own library 

|**Function Name**|`ft_strtrim`|
|---|---|
|**Prototype**|`char *ft_strtrim(char const *s1, char const *set);`|
|**Files to Submit**|`-`|
|**Parameters**|`s1:`<br>`The string to be trimmed.`<br>`set:`<br>`The string containing the set of characters`<br>`to be removed.`|
|**Return Value**|`The trimmed string.`<br>`NULL if the allocation fails.`|
|**External Function**|`malloc`|
|**Description**|`Allocates memory (using malloc(3)) and returns a`<br>`copy of ’s1’ with characters from ’set’ removed`<br>`from the beginning and the end.`|



|**Function Name**|`ft_split`|
|---|---|
|**Prototype**|`char **ft_split(char const *s, char c);`|
|**Files to Submit**|`-`|
|**Parameters**|`s:`<br>`The string to be split.`<br>`c:`<br>`The delimiter character.`|
|**Return Value**|`The array of new strings resulting from the split.`<br>`NULL if any allocation fails.`<br>`The returned structure will be released using:`<br>`1)`<br>`free() on each string in the array; 2) free() the`<br>`array itself.`|
|**External Function**|`malloc, free`|
|**Description**|`Allocates memory (using malloc(3)) and returns an`<br>`array of strings obtained by splitting ’s’ using`<br>`the character ’c’ as a delimiter.`<br>`Each string in the returned array is allocated`<br>`independently.`<br>`The array of pointers itself is also allocated`<br>`dynamically.`<br>`The returned array must be NULL terminated.`|



|**Function Name**|`ft_itoa`|
|---|---|
|**Prototype**|`char *ft_itoa(int n);`|
|**Files to Submit**|`-`|
|**Parameters**|`n:`<br>`The integer to convert.`|
|**Return Value**|`The string representing the integer.`<br>`NULL if the allocation fails.`|
|**External Function**|`malloc`|
|**Description**|`Allocates memory (using malloc(3)) and returns`<br>`a string representing the integer received as an`<br>`argument.`<br>`Negative numbers must be handled.`|



11 

Libft 

Your very first own library 

|**Function Name**|`ft_strmapi`|
|---|---|
|**Prototype**|`char *ft_strmapi(char const *s, char (*f)(unsigned`<br>`int, char));`|
|**Files to Submit**|`-`|
|**Parameters**|`s:`<br>`The string to iterate over.`<br>`f:`<br>`The function to apply to each character.`|
|**Return Value**|`The string created from the successive applications`<br>`of ’f’.`<br>`Returns NULL if the allocation fails.`|
|**External Function**|`malloc`|
|**Description**|`Applies the function f to each character of the`<br>`string s, passing its index as the first argument`<br>`and the character itself as the second.`<br>`A new`<br>`string is created (using malloc(3)) to store the`<br>`results from the successive applications of f.`|
|**Function Name**|`ft_striteri`|
|**Prototype**|`void ft_striteri(char *s, void (*f)(unsigned int,`<br>`char*));`|
|**Files to Submit**|`-`|
|**Parameters**|`s:`<br>`The string to iterate over.`<br>`f:`<br>`The function to apply to each character.`|
|**Return Value**|`None`|
|**External Function**|`None`|
|**Description**|`Applies the function ’f’ to each character of the`<br>`string passed as argument, passing its index as`<br>`the first argument.`<br>`Each character is passed by`<br>`address to ’f’ so it can be modified if necessary.`|



|**Function Name**|`ft_putchar_fd`|
|---|---|
|**Prototype**|`void ft_putchar_fd(char c, int fd);`|
|**Files to Submit**|`-`|
|**Parameters**|`c:`<br>`The character to output.`<br>`fd:`<br>`The file descriptor on which to write.`|
|**Return Value**|`None`|
|**External Function**|`write`|
|**Description**|`Outputs the character ’c’ to the specified file`<br>`descriptor.`|



12 

Libft 

Your very first own library 

|**Function Name**|`ft_putstr_fd`|
|---|---|
|**Prototype**|`void ft_putstr_fd(char *s, int fd);`|
|**Files to Submit**|`-`|
|**Parameters**|`s:`<br>`The string to output.`<br>`fd:`<br>`The file descriptor on which to write.`|
|**Return Value**|`None`|
|**External Function**|`write`|
|**Description**|`Outputs the string ’s’ to the specified file`<br>`descriptor.`|



|**Function Name**|`ft_putendl_fd`|
|---|---|
|**Prototype**|`void ft_putendl_fd(char *s, int fd);`|
|**Files to Submit**|`-`|
|**Parameters**|`s:`<br>`The string to output.`<br>`fd:`<br>`The file descriptor on which to write.`|
|**Return Value**|`None`|
|**External Function**|`write`|
|**Description**|`Outputs the string ’s’ to the specified file`<br>`descriptor followed by a newline.`|



|**Function Name**|`ft_putnbr_fd`|
|---|---|
|**Prototype**|`void ft_putnbr_fd(int n, int fd);`|
|**Files to Submit**|`-`|
|**Parameters**|`n:`<br>`The integer to output.`<br>`fd:`<br>`The file descriptor on which to write.`|
|**Return Value**|`None`|
|**External Function**|`write`|
|**Description**|`Outputs the integer ’n’ to the specified file`<br>`descriptor.`|



13 

Libft 

Your very first own library 

## **IV.4 Part 3 - linked list** 

Memory and string manipulation functions are useful. But you will soon discover that manipulating lists is even more useful. 

In this third part, you have to implement functions using a structure to manipulate linked list. To do so, add the following structure declaration to your `libft.h` file: 

```
typedefstructs_list
{
void*content;
structs_list*next;
}t_list;
```

The members of the `t_list` struct are: 

- `content` : The data contained in the node. Using `void *` allows you to store any type of data. 

- `next` : The address of the next node, or `NULL` if the current node is the last one. 

Implement the following functions in order to easily use your lists: 

|**Function Name**|`ft_lstnew`|
|---|---|
|**Prototype**|`t_list *ft_lstnew(void *content);`|
|**Files to Submit**|`-`|
|**Parameters**|`content:`<br>`The content to store in the new node.`|
|**Return Value**|`A pointer to the new node`|
|**External Function**|`malloc`|
|**Description**|`Allocates memory (using malloc(3)) and returns`<br>`a new node.`<br>`The ’content’ member variable is`<br>`initialized with the given parameter ’content’.`|
||`The variable ’next’ is initialized to NULL.`|



|**Function Name**|`ft_lstadd_front`|
|---|---|
|**Prototype**|`void ft_lstadd_front(t_list **lst, t_list *new);`|
|**Files to Submit**|`-`|
|**Parameters**|`lst:`<br>`The address of a pointer to the first node of`<br>`a list.`<br>`new:`<br>`The address of a pointer to the node to be`<br>`added.`|
|**Return Value**|`None`|
|**External Function**|`None`|
|**Description**|`Adds the node ’new’ at the beginning of the list.`|



14 

Libft 

Your very first own library 

|**Function Name**|`ft_lstsize`|
|---|---|
|**Prototype**|`int ft_lstsize(t_list *lst);`|
|**Files to Submit**|`-`|
|**Parameters**|`lst:`<br>`The beginning of the list.`|
|**Return Value**|`The length of the list`|
|**External Function**|`None`|
|**Description**|`Counts the number of nodes in the list.`|



|**Function Name**|`ft_lstlast`|
|---|---|
|**Prototype**|`t_list *ft_lstlast(t_list *lst);`|
|**Files to Submit**|`-`|
|**Parameters**|`lst:`<br>`The beginning of the list.`|
|**Return Value**|`Last node of the list`|
|**External Function**|`None`|
|**Description**|`Returns the last node of the list.`|



|**Function Name**|`ft_lstadd_back`|
|---|---|
|**Prototype**|`void ft_lstadd_back(t_list **lst, t_list *new);`|
|**Files to Submit**|`-`|
|**Parameters**|`lst:`<br>`The address of a pointer to the first node of`<br>`a list.`<br>`new:`<br>`The address of a pointer to the node to be`<br>`added.`|
|**Return Value**|`None`|
|**External Function**|`None`|
|**Description**|`Adds the node ’new’ at the end of the list.`|



|**Function Name**|`ft_lstdelone`|
|---|---|
|**Prototype**|`void ft_lstdelone(t_list *lst, void (*del)(void`<br>`*));`|
|**Files to Submit**|`-`|
|**Parameters**|`lst:`<br>`The node to free.`<br>`del:`<br>`The address of the function used to delete`<br>`the content.`|
|**Return Value**|`None`|
|**External Function**|`free`|
|**Description**|`Takes a node as parameter and frees its content`<br>`using the function ’del’.`<br>`Free the node itself but`<br>`does NOT free the next node.`|



15 

Libft 

Your very first own library 

|**Function Name**|`ft_lstclear`|
|---|---|
|**Prototype**|`void ft_lstclear(t_list **lst, void (*del)(void`<br>`*));`|
|**Files to Submit**|`-`|
|**Parameters**|`lst:`<br>`The address of a pointer to a node.`<br>`del:`<br>`The address of the function used to delete`<br>`the content of the node.`|
|**Return Value**|`None`|
|**External Function**|`free`|
|**Description**|`Deletes and frees the given node and all its`<br>`successors, using the function ’del’ and free(3).`<br>`Finally, set the pointer to the list to NULL.`|



|**Function Name**|`ft_lstiter`|
|---|---|
|**Prototype**|`void ft_lstiter(t_list *lst, void (*f)(void *));`|
|**Files to Submit**|`-`|
|**Parameters**|`lst:`<br>`The address of a pointer to a node.`|
||`f:`<br>`The address of the function to apply to each`<br>`node’s content.`|
|**Return Value**|`None`|
|**External Function**|`None`|
|**Description**|`Iterates through the list ’lst’ and applies the`<br>`function ’f’ to the content of each node.`|



|**Function Name**|`ft_lstmap`|
|---|---|
|**Prototype**|`t_list *ft_lstmap(t_list *lst, void *(*f)(void *),`<br>`void (*del)(void *));`|
|**Files to Submit**|`-`|
|**Parameters**|`lst:`<br>`The address of a pointer to a node.`<br>`f:`<br>`The address of the function applied to each`<br>`node’s content.`<br>`del:`<br>`The address of the function used to delete a`<br>`node’s content if needed.`|
|**Return Value**|`The new list.`<br>`NULL if the allocation fails.`|
|**External Function**|`malloc, free`|
|**Description**|`Iterates through the list ’lst’, applies the`<br>`function ’f’ to each node’s content, and creates`<br>`a new list resulting of the successive applications`<br>`of the function ’f’.`<br>`The ’del’ function is used to`<br>`delete the content of a node if needed.`|



16 

# **Chapter V** 

# **Readme Requirements** 

A `README.md` file must be provided at the root of your Git repository. Its purpose is to allow anyone unfamiliar with the project (peers, staff, recruiters, etc.) to quickly understand what the project is about, how to run it, and where to find more information on the topic. 

The `README.md` must include at least: 

- The very first line must be italicized and read: _This project has been created as part of the 42 curriculum by <login1>[, <login2>[, <login3>[...]]]._ 

- A “ **Description** ” section that clearly presents the project, including its goal and a brief overview. 

- An “ **Instructions** ” section containing any relevant information about compilation, installation, and/or execution. 

- A “ **Resources** ” section listing classic references related to the topic (documentation, articles, tutorials, etc.), as well as a description of how AI was used — specifying for which tasks and which parts of the project. 

- ➠ **Additional sections may be required depending on the project** (e.g., usage examples, feature list, technical choices, etc.). 

_Any required additions will be explicitly listed below._ 

- A detailed description of the library created for this project must also be included. 



```
Englishisrecommended;alternatively,youmayusethemainlanguage
ofyourcampus.
```

17 

# **Chapter VI** 

# **Submission and peer-evaluation** 

Submit your assignment in your `Git` repository as usual. Only the work inside your repository will be evaluated during the peer evaluation. Make sure to double-check the names of your files to ensure they are correct. 



```
Placeallyourfilesattherootofyourrepository.
```

During the evaluation, a brief **modification of the project** may occasionally be requested. This could involve a minor behaviour change, a few lines of code to write or rewrite, or an easy-to-add feature. 

While this step may **not be applicable to every project** , you must be prepared for it if it is mentioned in the evaluation guidelines. 

This step is meant to verify your actual understanding of a specific part of the project. The modification can be performed in any development environment you choose (e.g., your usual setup), and it should be feasible within a few minutes — unless a specific time frame is defined as part of the evaluation. 

You can, for example, be asked to make a small update to a function or script, modify a display, or adjust a data structure to store new information, etc. 

The details (scope, target, etc.) will be specified in the **evaluation guidelines** and may vary from one evaluation to another for the same project. 

18 

