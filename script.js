// Global state variables
let tokensGlobal = [];
let parseTreeGlobal = null;

// Event listeners for Start and Clear buttons
document.getElementById("startBtn").addEventListener("click", startProcess);
document.getElementById("clearBtn").addEventListener("click", clearProcess);

function startProcess() {
  const code = document.getElementById("codeInput").value;
  if (!code.trim()) {
    alert("Please enter some code.");
    return;
  }
  
  // --- Lexical Analysis ---
  tokensGlobal = tokenize(code);
  displayTokens(tokensGlobal);
  
  // --- Parsing ---
  try {
    parseTreeGlobal = parseTokens(tokensGlobal);
  } catch (e) {
    alert("Parsing error: " + e.message);
    return;
  }
  
  // --- Parse Tree Visualization ---
  renderTree(parseTreeGlobal);
  
  // --- Semantic Analysis & Code Generation ---
  let generatedCode;
  try {
    generatedCode = semanticAnalysisAndCodeGeneration(parseTreeGlobal);
  } catch (e) {
    alert("Semantic Analysis error: " + e.message);
    return;
  }
  displayGeneratedCode(generatedCode);
}

function clearProcess() {
  // Clear code input, tokens list, parse tree, and generated code display.
  document.getElementById("codeInput").value = "";
  document.getElementById("tokensList").innerHTML = "";
  d3.select("#parseTreeSvg").selectAll("*").remove();
  document.getElementById("codeGenOutput").innerText = "";
}

// --------------------
// Lexical Analyzer
// --------------------
function tokenize(input) {
  // Define token patterns: numbers, operators, whitespace, and parentheses.
  const tokenPatterns = [
    { type: "NUMBER", regex: /\d+/y },
    { type: "OPERATOR", regex: /[+\-*/]/y },
    { type: "WHITESPACE", regex: /\s+/y },
    { type: "PAREN", regex: /[()]/y }
  ];
  
  let tokens = [];
  let pos = 0;
  
  while (pos < input.length) {
    let matched = false;
    for (let pattern of tokenPatterns) {
      pattern.regex.lastIndex = pos;
      const match = pattern.regex.exec(input);
      if (match) {
        // Skip whitespace tokens
        if (pattern.type !== "WHITESPACE") {
          tokens.push({ type: pattern.type, value: match[0] });
        }
        pos = pattern.regex.lastIndex;
        matched = true;
        break;
      }
    }
    if (!matched) {
      console.error("Unexpected character at position " + pos);
      pos++; // Skip unrecognized characters
    }
  }
  
  return tokens;
}

function displayTokens(tokens) {
  const tokensList = document.getElementById("tokensList");
  tokensList.innerHTML = ""; // Clear previous tokens
  tokens.forEach(token => {
    const tokenDiv = document.createElement("div");
    tokenDiv.className = "token";
    // tokenDiv.innerText = ${token.type}: ${token.value};
    tokenDiv.innerText = `${token.type}: ${token.value}`;

    tokensList.appendChild(tokenDiv);
  });
}

// --------------------
// Parser (Recursive Descent)
// --------------------

// Global variables for parser state
let currentTokenIndex;
let tokensForParser;

function parseTokens(tokens) {
  tokensForParser = tokens;
  currentTokenIndex = 0;
  const tree = parseExpression();
  if (currentTokenIndex < tokensForParser.length) {
    throw new Error("Unexpected tokens remaining");
  }
  return tree;
}

// Grammar:
// Expression -> Term ((+|-) Term)*
// Term -> Factor ((|/) Factor)
// Factor -> NUMBER | '(' Expression ')'

function parseExpression() {
  let node = parseTerm();
  while (currentTokenIndex < tokensForParser.length &&
         tokensForParser[currentTokenIndex].type === "OPERATOR" &&
         (tokensForParser[currentTokenIndex].value === "+" || tokensForParser[currentTokenIndex].value === "-")) {
    const op = tokensForParser[currentTokenIndex];
    currentTokenIndex++;
    const rightNode = parseTerm();
    node = {
      name: op.value,
      children: [node, rightNode]
    };
  }
  return node;
}

function parseTerm() {
  let node = parseFactor();
  while (currentTokenIndex < tokensForParser.length &&
         tokensForParser[currentTokenIndex].type === "OPERATOR" &&
         (tokensForParser[currentTokenIndex].value === "*" || tokensForParser[currentTokenIndex].value === "/")) {
    const op = tokensForParser[currentTokenIndex];
    currentTokenIndex++;
    const rightNode = parseFactor();
    node = {
      name: op.value,
      children: [node, rightNode]
    };
  }
  return node;
}

function parseFactor() {
  const token = tokensForParser[currentTokenIndex];
  if (!token) {
    throw new Error("Unexpected end of input");
  }
  
  if (token.type === "NUMBER") {
    currentTokenIndex++;
    return { name: token.value };
  } else if (token.type === "PAREN" && token.value === "(") {
    currentTokenIndex++; // Consume '('
    const node = parseExpression();
    if (
      currentTokenIndex >= tokensForParser.length ||
      tokensForParser[currentTokenIndex].type !== "PAREN" ||
      tokensForParser[currentTokenIndex].value !== ")"
    ) {
      throw new Error("Expected ')'");
    }
    currentTokenIndex++; // Consume ')'
    return node;
  } else {
    throw new Error("Unexpected token: " + token.value);
  }
}

// --------------------
// Parse Tree Visualization (D3.js)
// --------------------
function renderTree(treeData) {
  // Clear previous SVG content
  d3.select("#parseTreeSvg").selectAll("*").remove();
  
  // Set dimensions and margins for the diagram
  const margin = {top: 20, right: 90, bottom: 30, left: 90},
        svgElement = document.getElementById("parseTreeSvg"),
        width = svgElement.clientWidth - margin.left - margin.right,
        height = svgElement.getAttribute("height") - margin.top - margin.bottom;

  const svg = d3.select("#parseTreeSvg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Create the tree layout
  const treemap = d3.tree().size([width, height]);

  // Convert the data into a hierarchy
  const root = d3.hierarchy(treeData, d => d.children);

  // Generate the tree layout
  const treeDataLayout = treemap(root);
  const nodes = treeDataLayout.descendants();
  const links = treeDataLayout.descendants().slice(1);

  // Create links between nodes
  svg.selectAll(".link")
      .data(links)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", d => {
        return "M" + d.x + "," + d.y +
               "C" + d.x + "," + (d.y + d.parent.y) / 2 +
               " " + d.parent.x + "," + (d.y + d.parent.y) / 2 +
               " " + d.parent.x + "," + d.parent.y;
      })
      .attr("fill", "none")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 2);

  // Create nodes
  const node = svg.selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", d => "translate(" + d.x + "," + d.y + ")");

  // Append circles for each node
  node.append("circle")
      .attr("r", 20)
      .attr("fill", "#fff")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 3);

  // Append text labels for each node
  node.append("text")
      .attr("dy", ".35em")
      .attr("y", d => d.children ? -25 : 25)
      .attr("text-anchor", "middle")
      .text(d => d.data.name);
}

// --------------------
// Semantic Analysis & Code Generation
// --------------------
// For this simple arithmetic language, we perform a basic semantic check (e.g., division by zero)
// and generate a postfix (Reverse Polish Notation) representation as the intermediate code.

function semanticAnalysisAndCodeGeneration(tree) {
  // Recursively generate postfix expression while checking for division by zero.
  return generatePostfix(tree);
}

function generatePostfix(node) {
  // If the node is a leaf (number), return its value.
  if (!node.children || node.children.length === 0) {
    return node.name;
  }
  // Otherwise, generate postfix for left and right children.
  const left = generatePostfix(node.children[0]);
  const right = generatePostfix(node.children[1]);
  
  // If the operator is division and the right child is a literal zero, report an error.
  if (
    node.name === "/" &&
    (!node.children[1].children || node.children[1].children.length === 0) &&
    parseFloat(node.children[1].name) === 0
  ) {
    throw new Error("Division by zero detected during semantic analysis.");
  }
  
  return left + " " + right + " " + node.name;
}

function displayGeneratedCode(generatedCode) {
  document.getElementById("codeGenOutput").innerText = generatedCode;
}