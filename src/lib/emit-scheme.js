// Part of phpstorm-theme-generator — see LICENSE.
/**
 * Emits the editor colour scheme XML: 119 <colors> options and 308
 * <attributes> entries, including the console/terminal ANSI sets and the
 * PHP/Blade/Twig keys.
 *
 * Two traps encoded here, both verified against real PhpStorm exports:
 *   - PHP keys are PHP_* with underscores, and PHP_PREDEFINED SYMBOL contains
 *     a literal SPACE. Dotted PHP.* keys do not exist and are ignored silently.
 *   - PHP_SCRIPTING_BACKGROUND must be explicitly cleared, or the inherited
 *     value paints a grey band behind every <?php ?> block inside Blade/HTML.
 */
import { mix, alpha, noHash, ensure } from './color.js';
import { resolveOptions, COMMENT_ATTRS, KEYWORD_ATTRS } from './options.js';

/* ---------- editor colour scheme XML ---------- */
export function buildSchemeXml(res,meta,options={}){
  const o=resolveOptions(options);
  const T=res.T;
  const h=k=>noHash(T[k]);
  /* A colour used as type on the editor page. Accents and status colours are
     tuned as fills and marks; set as running text they can sit near 2:1, above
     all when a dark palette is carried to a light variant. */
  const ht=k=>noHash(ensure(T[k],T.bgEditor,4.5,res.sign));
  const hx=k=>/^(sem|accentSecondary|accentTertiary)/.test(k)?ht(k):h(k);
  const m=(a,b,t)=>noHash(mix(T[a],T[b],t));
  const al=(k,a)=>noHash(alpha(T[k],a));

  const COLORS=[
    ['CARET_COLOR',h('caret')],['CARET_ROW_COLOR',h('caretRow')],
    ['SELECTION_BACKGROUND',h('bgSelection')],['SELECTION_BACKGROUND_INACTIVE',h('bgSelectionInactive')],
    ['GUTTER_BACKGROUND',h('bgEditor')],['LINE_NUMBERS_COLOR',h('fgDisabled')],
    ['LINE_NUMBER_ON_CARET_ROW_COLOR',h('fgMuted')],['ANNOTATIONS_COLOR',h('fgSubtle')],
    ['INDENT_GUIDE',h('guideIndent')],['SELECTED_INDENT_GUIDE',h('guideIndentOn')],
    ['VISUAL_INDENT_GUIDE',h('guideIndent')],['STRING_CONTENT_INDENT_GUIDE',h('guideIndent')],
    ['WHITESPACES',m('fgDefault','bgEditor',0.80)],['RIGHT_MARGIN_COLOR',m('fgDefault','bgEditor',0.90)],
    ['SOFT_WRAP_SIGN_COLOR',h('fgSubtle')],['TEARLINE_COLOR',h('separator')],
    ['SELECTED_TEARLINE_COLOR',h('accentPrimary')],['METHOD_SEPARATORS_COLOR',h('separator')],
    ['SEPARATOR_ABOVE_COLOR',h('separator')],['SEPARATOR_BELOW_COLOR',h('separator')],
    ['READONLY_FRAGMENT_BACKGROUND',m('fgDefault','bgEditor',0.96)],
    ['FOLDED_TEXT_BORDER_COLOR',h('borderDefault')],['DOC_COMMENT_GUIDE',h('guideIndent')],
    ['DOC_COMMENT_LINK',h('accentPrimary')],['RECENT_LOCATIONS_SELECTION',h('bgSelectionUi')],
    ['GRID_STRIPE_COLOR',m('fgDefault','bgEditor',0.965)],
    ['DOCUMENTATION_COLOR',h('bgRaised')],['LOOKUP_COLOR',h('bgRaised')],
    ['NOTIFICATION_BACKGROUND',h('bgRaised')],['ERROR_HINT',m('semError','bgRaised',0.86)],
    ['INFORMATION_HINT',h('bgRaised')],['QUESTION_HINT',m('semInfo','bgRaised',0.86)],
    ['MODIFIED_TAB_ICON',h('accentSecondary')],
    ['INLINE_REFACTORING_SETTINGS_DEFAULT',al('fgDefault',0.10)],
    ['INLINE_REFACTORING_SETTINGS_FOCUSED',al('accentPrimary',0.25)],
    ['INLINE_REFACTORING_SETTINGS_HOVERED',al('fgDefault',0.16)],
    ['CONSOLE_BACKGROUND_KEY',h('bgEditor')],
    ['ADDED_LINES_COLOR',m('semSuccess','bgEditor',0.60)],
    ['MODIFIED_LINES_COLOR',m('semModify','bgEditor',0.60)],
    ['DELETED_LINES_COLOR',m('semError','bgEditor',0.60)],
    ['WHITESPACES_MODIFIED_LINES_COLOR',m('semModify','bgEditor',0.40)],
    ['IGNORED_ADDED_LINES_BORDER_COLOR',m('semSuccess','bgEditor',0.75)],
    ['IGNORED_MODIFIED_LINES_BORDER_COLOR',m('semModify','bgEditor',0.75)],
    ['IGNORED_DELETED_LINES_BORDER_COLOR',m('semError','bgEditor',0.75)],
    ['DIFF_SEPARATORS_BACKGROUND',h('separator')],['DIFF_SEPARATOR_WAVE',h('semWarning')]
  ];
  const fs={ADDED:'semSuccess',COPIED:'semSuccess',MODIFIED:'semModify',RENAMED:'semModify',
    DELETED:'fgDisabled',MERGED:'synConstant',UNKNOWN:'semWarning',NOT_CHANGED:'fgDefault',
    NOT_CHANGED_IMMEDIATE:'fgDefault',NOT_CHANGED_RECURSIVE:'fgDefault',HIJACKED:'semWarning',
    OBSOLETE:'fgDisabled',SWITCHED:'synConstant',SUPPRESSED:'fgDisabled'};
  for(const [k,v] of Object.entries(fs)) COLORS.push(['FILESTATUS_'+k,h(v)]);
  COLORS.push(['FILESTATUS_addedOutside',h('semSuccess')],['FILESTATUS_modifiedOutside',h('semModify')],
    ['FILESTATUS_changelistConflict',h('semError')],
    ['FILESTATUS_IDEA_FILESTATUS_IGNORED',h('fgDisabled')],
    ['FILESTATUS_IDEA_FILESTATUS_DELETED_FROM_FILE_SYSTEM',h('fgDisabled')],
    ['FILESTATUS_IDEA_FILESTATUS_MERGED_WITH_CONFLICTS',h('semError')],
    ['FILESTATUS_IGNORE.PROJECT_VIEW.IGNORED',h('fgDisabled')]);
  for(let i=0;i<5;i++) COLORS.push(['VCS_ANNOTATIONS_COLOR_'+(i+1),m('accentPrimary','bgEditor',0.95-0.05*i)]);
  for(let i=0;i<6;i++) COLORS.push(['HTML_TAG_TREE_LEVEL'+i,al('accentPrimary',0.05*(i+1))]);
  for(const p of ['ScrollBar.','ScrollBar.Transparent.','ScrollBar.Mac.','ScrollBar.Mac.Transparent.'])
    COLORS.push([p+'thumbColor',al('fgDefault',0.20)],[p+'thumbBorderColor',al('fgDefault',0.20)],
      [p+'hoverThumbColor',al('fgDefault',0.32)],[p+'hoverThumbBorderColor',al('fgDefault',0.32)],
      [p+'trackColor','00000000'],[p+'hoverTrackColor',al('fgDefault',0.06)]);
  COLORS.push(['Scrollbar.Tabs.ThumbColor',al('fgDefault',0.20)],
    ['Scrollbar.Tabs.HoveredThumbColor',al('fgDefault',0.32)],
    ['Scrollbar.Tabs.TransparentThumbColor',al('fgDefault',0.20)],
    ['BLOCK_TERMINAL_DEFAULT_BACKGROUND',h('bgEditor')],
    ['BLOCK_TERMINAL_DEFAULT_FOREGROUND',h('fgDefault')],
    ['BLOCK_TERMINAL_BLOCK_BACKGROUND_START',h('bgBase')],
    ['BLOCK_TERMINAL_BLOCK_BACKGROUND_END',h('bgBase')],
    ['BLOCK_TERMINAL_HOVERED_BLOCK_BACKGROUND_START',h('bgHover')],
    ['BLOCK_TERMINAL_HOVERED_BLOCK_BACKGROUND_END',h('bgHover')],
    ['BLOCK_TERMINAL_SELECTED_BLOCK_BACKGROUND',h('bgRaised')],
    ['BLOCK_TERMINAL_SELECTED_BLOCK_STROKE_COLOR',h('accentPrimary')],
    ['BLOCK_TERMINAL_INACTIVE_SELECTED_BLOCK_BACKGROUND',h('bgBase')],
    ['BLOCK_TERMINAL_INACTIVE_SELECTED_BLOCK_STROKE_COLOR',h('borderDefault')],
    ['BLOCK_TERMINAL_ERROR_BLOCK_STROKE_COLOR',h('semError')],
    ['BLOCK_TERMINAL_PROMPT_SEPARATOR_COLOR',h('separator')],
    ['BLOCK_TERMINAL_GENERATE_COMMAND_CARET_COLOR',h('caret')],
    ['BLOCK_TERMINAL_GENERATE_COMMAND_PLACEHOLDER_FOREGROUND',h('fgDisabled')]);

  const A=[];
  const at=(name,o)=>A.push({name,v:o});
  const inh=(name,base)=>A.push({name,base});
  const clr=name=>A.push({name,v:{}});

  at('TEXT',{FOREGROUND:h('fgDefault'),BACKGROUND:h('bgEditor')});
  at('BAD_CHARACTER',{FOREGROUND:h('synInvalid'),EFFECT_COLOR:h('semError'),EFFECT_TYPE:'2'});
  at('DEFAULT_IDENTIFIER',{FOREGROUND:h('fgDefault')});
  at('DEFAULT_KEYWORD',{FOREGROUND:h('synKeyword'),FONT_TYPE:'1'});
  at('DEFAULT_NUMBER',{FOREGROUND:h('synNumber')});
  at('DEFAULT_STRING',{FOREGROUND:h('synString')});
  at('DEFAULT_VALID_STRING_ESCAPE',{FOREGROUND:h('synConstant')});
  at('DEFAULT_INVALID_STRING_ESCAPE',{FOREGROUND:h('synInvalid'),EFFECT_COLOR:h('semError'),EFFECT_TYPE:'2'});
  at('DEFAULT_LINE_COMMENT',{FOREGROUND:h('synComment'),FONT_TYPE:'2'});
  at('DEFAULT_BLOCK_COMMENT',{FOREGROUND:h('synComment'),FONT_TYPE:'2'});
  at('DEFAULT_DOC_COMMENT',{FOREGROUND:h('synComment'),FONT_TYPE:'2'});
  at('DEFAULT_DOC_COMMENT_TAG',{FOREGROUND:m('synComment','synKeyword',0.5),FONT_TYPE:'2'});
  at('DEFAULT_DOC_COMMENT_TAG_VALUE',{FOREGROUND:m('synComment','synType',0.5),FONT_TYPE:'2'});
  at('DEFAULT_DOC_MARKUP',{FOREGROUND:h('synComment')});
  at('DEFAULT_OPERATION_SIGN',{FOREGROUND:h('synOperator')});
  for(const k of ['DEFAULT_BRACES','DEFAULT_BRACKETS','DEFAULT_PARENTHS','DEFAULT_DOT',
    'DEFAULT_SEMICOLON','DEFAULT_COMMA']) at(k,{FOREGROUND:h('synPunct')});
  at('DEFAULT_LABEL',{FOREGROUND:h('synConstant')});
  at('DEFAULT_CONSTANT',{FOREGROUND:h('synConstant')});
  at('DEFAULT_PREDEFINED_SYMBOL',{FOREGROUND:h('synConstant')});
  at('DEFAULT_METADATA',{FOREGROUND:h('synMetadata')});
  at('DEFAULT_LOCAL_VARIABLE',{FOREGROUND:h('synVariable')});
  at('DEFAULT_REASSIGNED_LOCAL_VARIABLE',{FOREGROUND:h('synVariable'),EFFECT_COLOR:h('fgDisabled'),EFFECT_TYPE:'1'});
  at('DEFAULT_GLOBAL_VARIABLE',{FOREGROUND:h('synVariable'),FONT_TYPE:'2'});
  at('DEFAULT_PARAMETER',{FOREGROUND:h('synVariable')});
  at('DEFAULT_REASSIGNED_PARAMETER',{FOREGROUND:h('synVariable'),EFFECT_COLOR:h('fgDisabled'),EFFECT_TYPE:'1'});
  at('DEFAULT_INSTANCE_FIELD',{FOREGROUND:m('synVariable','synType',0.45)});
  at('DEFAULT_STATIC_FIELD',{FOREGROUND:m('synVariable','synType',0.45),FONT_TYPE:'2'});
  at('DEFAULT_INSTANCE_METHOD',{FOREGROUND:h('synFunction')});
  at('DEFAULT_STATIC_METHOD',{FOREGROUND:h('synFunction'),FONT_TYPE:'2'});
  at('DEFAULT_FUNCTION_CALL',{FOREGROUND:h('synFunction')});
  at('DEFAULT_FUNCTION_DECLARATION',{FOREGROUND:h('synFunction')});
  at('DEFAULT_CLASS_NAME',{FOREGROUND:h('synType')});
  at('DEFAULT_CLASS_REFERENCE',{FOREGROUND:h('synType')});
  at('DEFAULT_INTERFACE_NAME',{FOREGROUND:h('synType'),FONT_TYPE:'2'});
  at('DEFAULT_TAG',{FOREGROUND:h('synKeyword')});
  at('DEFAULT_ATTRIBUTE',{FOREGROUND:h('synMetadata')});
  at('DEFAULT_ENTITY',{FOREGROUND:h('synConstant')});
  at('DEFAULT_HIGHLIGHTED_REFERENCE',{FOREGROUND:h('fgDefault'),EFFECT_COLOR:h('accentPrimary'),EFFECT_TYPE:'1'});
  at('DEFAULT_TEMPLATE_LANGUAGE_COLOR',{BACKGROUND:m('accentPrimary','bgEditor',0.965)});
  at('ERRORS_ATTRIBUTES',{EFFECT_COLOR:h('semError'),EFFECT_TYPE:'2',ERROR_STRIPE_COLOR:h('semError')});
  at('WARNING_ATTRIBUTES',{EFFECT_COLOR:h('semWarning'),EFFECT_TYPE:'2',ERROR_STRIPE_COLOR:h('semWarning')});
  at('WEAK_WARNING_ATTRIBUTES',{EFFECT_COLOR:m('semWarning','bgEditor',0.35),EFFECT_TYPE:'2',
    ERROR_STRIPE_COLOR:m('semWarning','bgEditor',0.35)});
  at('INFO_ATTRIBUTES',{EFFECT_COLOR:h('semInfo'),EFFECT_TYPE:'2'});
  at('GENERIC_SERVER_ERROR_OR_WARNING',{EFFECT_COLOR:h('semWarning'),EFFECT_TYPE:'2'});
  at('DUPLICATE_FROM_SERVER',{BACKGROUND:m('fgDefault','bgEditor',0.95)});
  at('RUNTIME_ERROR',{EFFECT_COLOR:h('semError'),EFFECT_TYPE:'2'});
  at('WRONG_REFERENCES_ATTRIBUTES',{FOREGROUND:ht('semError')});
  at('TYPO',{EFFECT_COLOR:m('semSuccess','bgEditor',0.30),EFFECT_TYPE:'2'});
  at('NOT_USED_ELEMENT_ATTRIBUTES',{FOREGROUND:h('fgDisabled')});
  at('DEPRECATED_ATTRIBUTES',{EFFECT_COLOR:h('fgSubtle'),EFFECT_TYPE:'3'});
  at('MARKED_FOR_REMOVAL_ATTRIBUTES',{EFFECT_COLOR:h('semError'),EFFECT_TYPE:'3'});
  at('FILESTATUS_ERRORS',{FOREGROUND:ht('semError')});
  at('SUGGESTION',{EFFECT_COLOR:h('accentPrimary'),EFFECT_TYPE:'1'});
  at('IDENTIFIER_UNDER_CARET_ATTRIBUTES',{BACKGROUND:m('accentPrimary','bgEditor',0.84)});
  at('WRITE_IDENTIFIER_UNDER_CARET_ATTRIBUTES',{BACKGROUND:m('accentSecondary','bgEditor',0.80)});
  at('TEXT_SEARCH_RESULT_ATTRIBUTES',{FOREGROUND:h('fgDefault'),BACKGROUND:m('accentSecondary','bgEditor',0.62)});
  at('SEARCH_RESULT_ATTRIBUTES',{BACKGROUND:m('accentSecondary','bgEditor',0.62)});
  at('WRITE_SEARCH_RESULT_ATTRIBUTES',{BACKGROUND:m('accentSecondary','bgEditor',0.52)});
  at('BLINKING_HIGHLIGHTS_ATTRIBUTES',{FOREGROUND:h('fgInverse'),BACKGROUND:h('accentPrimary')});
  at('MATCHED_BRACE_ATTRIBUTES',{BACKGROUND:m('accentPrimary','bgEditor',0.80),FONT_TYPE:'1'});
  at('UNMATCHED_BRACE_ATTRIBUTES',{BACKGROUND:m('semError','bgEditor',0.80)});
  at('MATCHED_TAG_NAME',{BACKGROUND:m('accentPrimary','bgEditor',0.85)});
  at('FOLDED_TEXT_ATTRIBUTES',{FOREGROUND:h('fgSubtle'),BACKGROUND:m('fgDefault','bgEditor',0.92)});
  at('DELETED_TEXT_ATTRIBUTES',{FOREGROUND:h('fgDisabled'),EFFECT_COLOR:h('fgDisabled'),EFFECT_TYPE:'3'});
  at('INJECTED_LANGUAGE_FRAGMENT',{BACKGROUND:m('accentTertiary','bgEditor',0.96)});
  at('TODO_DEFAULT_ATTRIBUTES',{FOREGROUND:ht('semWarning'),FONT_TYPE:'1'});
  at('LIVE_TEMPLATE_ATTRIBUTES',{EFFECT_COLOR:h('accentPrimary'),EFFECT_TYPE:'0'});
  at('LIVE_TEMPLATE_INACTIVE_SEGMENT',{FOREGROUND:h('fgSubtle')});
  at('TEMPLATE_VARIABLE_ATTRIBUTES',{FOREGROUND:h('fgLink'),FONT_TYPE:'1'});
  at('BOOKMARKS_ATTRIBUTES',{ERROR_STRIPE_COLOR:h('accentSecondary')});
  at('HYPERLINK_ATTRIBUTES',{FOREGROUND:h('fgLink'),EFFECT_COLOR:h('fgLink'),EFFECT_TYPE:'1'});
  at('FOLLOWED_HYPERLINK_ATTRIBUTES',{FOREGROUND:h('accentPrimaryMuted'),EFFECT_COLOR:h('accentPrimaryMuted'),EFFECT_TYPE:'1'});
  at('INACTIVE_HYPERLINK_ATTRIBUTES',{FOREGROUND:h('fgSubtle')});
  at('CTRL_CLICKABLE',{FOREGROUND:h('fgLink'),EFFECT_COLOR:h('fgLink'),EFFECT_TYPE:'1'});
  at('BREADCRUMBS_DEFAULT',{FOREGROUND:h('fgMuted')});
  at('BREADCRUMBS_HOVERED',{FOREGROUND:h('fgDefault'),BACKGROUND:h('bgHover')});
  at('BREADCRUMBS_CURRENT',{FOREGROUND:h('fgDefault'),BACKGROUND:h('bgSelectionUi')});
  at('BREADCRUMBS_INACTIVE',{FOREGROUND:h('fgDisabled')});
  at('INLINE_PARAMETER_HINT',{FOREGROUND:h('fgSubtle'),BACKGROUND:m('fgDefault','bgEditor',0.92)});
  at('INLINE_PARAMETER_HINT_HIGHLIGHTED',{FOREGROUND:h('fgDefault'),BACKGROUND:m('accentPrimary','bgEditor',0.82)});
  at('INLINE_PARAMETER_HINT_CURRENT',{FOREGROUND:h('fgInverse'),BACKGROUND:h('accentPrimary')});
  at('INLAY_DEFAULT',{FOREGROUND:h('fgSubtle'),BACKGROUND:m('fgDefault','bgEditor',0.92)});
  at('INLAY_TEXT_WITHOUT_BACKGROUND',{FOREGROUND:h('fgSubtle')});
  at('INLAY_BUTTON_DEFAULT',{BACKGROUND:h('bgRaised')});
  at('INLAY_BUTTON_HOVERED',{BACKGROUND:h('bgHover')});
  at('INLAY_BUTTON_FOCUSED',{BACKGROUND:h('bgPress')});
  at('INLINE_SUGGESTION',{FOREGROUND:h('fgDisabled'),FONT_TYPE:'2'});
  at('DIFF_INSERTED',{BACKGROUND:m('semSuccess','bgEditor',0.82),ERROR_STRIPE_COLOR:h('semSuccess')});
  at('DIFF_MODIFIED',{BACKGROUND:m('semModify','bgEditor',0.82),ERROR_STRIPE_COLOR:h('semModify')});
  at('DIFF_DELETED',{BACKGROUND:m('semError','bgEditor',0.88),ERROR_STRIPE_COLOR:h('semError')});
  at('DIFF_CONFLICT',{BACKGROUND:m('semWarning','bgEditor',0.82),ERROR_STRIPE_COLOR:h('semWarning')});
  at('DIFF_ABSENT',{BACKGROUND:m('fgDefault','bgEditor',0.94)});
  at('BREAKPOINT_ATTRIBUTES',{BACKGROUND:m('semError','bgEditor',0.82)});
  at('EXECUTIONPOINT_ATTRIBUTES',{FOREGROUND:h('fgDefault'),BACKGROUND:m('accentPrimary','bgEditor',0.76)});
  at('NOT_TOP_FRAME_ATTRIBUTES',{BACKGROUND:m('accentPrimary','bgEditor',0.90)});
  at('EVALUATED_EXPRESSION_ATTRIBUTES',{BACKGROUND:m('accentSecondary','bgEditor',0.84)});
  at('EVALUATED_EXPRESSION_EXECUTION_LINE_ATTRIBUTES',{BACKGROUND:m('accentSecondary','bgEditor',0.76)});
  at('DEBUGGER_INLINED_VALUES',{FOREGROUND:h('fgSubtle'),FONT_TYPE:'2'});
  at('DEBUGGER_INLINED_VALUES_MODIFIED',{FOREGROUND:ht('accentSecondary'),FONT_TYPE:'2'});
  at('DEBUGGER_INLINED_VALUES_EXECUTION_LINE',{FOREGROUND:h('fgLink'),FONT_TYPE:'2'});
  at('DEBUGGER_SMART_STEP_INTO_TARGET',{BACKGROUND:m('accentPrimary','bgEditor',0.76)});
  at('DEBUGGER_SMART_STEP_INTO_SELECTION',{FOREGROUND:h('fgInverse'),BACKGROUND:h('accentPrimary')});
  at('INLINE_STACK_FRAMES',{FOREGROUND:h('fgSubtle')});
  at('LINE_FULL_COVERAGE',{FOREGROUND:ht('semSuccess')});
  at('LINE_PARTIAL_COVERAGE',{FOREGROUND:ht('semWarning')});
  at('LINE_NONE_COVERAGE',{FOREGROUND:ht('semError')});
  ['accentPrimary','accentSecondary','accentTertiary','synConstant','synFunction']
    .forEach((k,i)=>at('RAINBOW_COLOR'+i,{FOREGROUND:ht(k)}));
  at('CONSOLE_NORMAL_OUTPUT',{FOREGROUND:h('fgDefault')});
  at('CONSOLE_ERROR_OUTPUT',{FOREGROUND:ht('semError')});
  at('CONSOLE_SYSTEM_OUTPUT',{FOREGROUND:ht('semInfo')});
  at('CONSOLE_USER_INPUT',{FOREGROUND:ht('semSuccess'),FONT_TYPE:'2'});
  at('CONSOLE_RANGE_TO_EXECUTE',{BACKGROUND:m('accentPrimary','bgEditor',0.88)});
  at('CONSOLE_SELECTED_PARAMETER',{BACKGROUND:h('bgSelection')});
  const ANSI=[['CONSOLE_BLACK_OUTPUT','ansiBlack'],['CONSOLE_RED_OUTPUT','ansiRed'],
    ['CONSOLE_GREEN_OUTPUT','ansiGreen'],['CONSOLE_YELLOW_OUTPUT','ansiYellow'],
    ['CONSOLE_BLUE_OUTPUT','ansiBlue'],['CONSOLE_MAGENTA_OUTPUT','ansiMagenta'],
    ['CONSOLE_CYAN_OUTPUT','ansiCyan'],['CONSOLE_GRAY_OUTPUT','ansiWhite'],
    ['CONSOLE_DARKGRAY_OUTPUT','ansiBrightBlack'],['CONSOLE_RED_BRIGHT_OUTPUT','ansiBrightRed'],
    ['CONSOLE_GREEN_BRIGHT_OUTPUT','ansiBrightGreen'],['CONSOLE_YELLOW_BRIGHT_OUTPUT','ansiBrightYellow'],
    ['CONSOLE_BLUE_BRIGHT_OUTPUT','ansiBrightBlue'],['CONSOLE_MAGENTA_BRIGHT_OUTPUT','ansiBrightMagenta'],
    ['CONSOLE_CYAN_BRIGHT_OUTPUT','ansiBrightCyan'],['CONSOLE_WHITE_OUTPUT','ansiBrightWhite']];
  for(const [k,tok] of ANSI) at(k,{FOREGROUND:h(tok),BACKGROUND:h(tok)});
  const BT=[['BLACK','ansiBlack'],['RED','ansiRed'],['GREEN','ansiGreen'],['YELLOW','ansiYellow'],
    ['BLUE','ansiBlue'],['MAGENTA','ansiMagenta'],['CYAN','ansiCyan'],['WHITE','ansiWhite'],
    ['BLACK_BRIGHT','ansiBrightBlack'],['RED_BRIGHT','ansiBrightRed'],['GREEN_BRIGHT','ansiBrightGreen'],
    ['YELLOW_BRIGHT','ansiBrightYellow'],['BLUE_BRIGHT','ansiBrightBlue'],
    ['MAGENTA_BRIGHT','ansiBrightMagenta'],['CYAN_BRIGHT','ansiBrightCyan'],['WHITE_BRIGHT','ansiBrightWhite']];
  for(const [k,tok] of BT) at('BLOCK_TERMINAL_'+k,{FOREGROUND:h(tok),BACKGROUND:h(tok)});
  at('BLOCK_TERMINAL_COMMAND',{FOREGROUND:h('fgDefault'),FONT_TYPE:'1'});
  at('BLOCK_TERMINAL_SEARCH_ENTRY',{BACKGROUND:m('accentSecondary','bgEditor',0.60)});
  at('BLOCK_TERMINAL_CURRENT_SEARCH_ENTRY',{FOREGROUND:h('fgInverse'),BACKGROUND:h('accentSecondary')});
  [['LOG_VERBOSE_OUTPUT','fgDisabled'],['LOG_DEBUG_OUTPUT','fgSubtle'],['LOG_INFO_OUTPUT','fgDefault'],
   ['LOG_WARNING_OUTPUT','semWarning'],['LOG_ERROR_OUTPUT','semError'],['LOG_EXPIRED_ENTRY','fgDisabled']]
   .forEach(([k,t2])=>at(k,{FOREGROUND:hx(t2)}));
  /* PHP */
  at('PHP_TAG',{FOREGROUND:h('synMetadata')});
  clr('PHP_SCRIPTING_BACKGROUND');
  inh('PHP_VAR','DEFAULT_LOCAL_VARIABLE');
  inh('PHP_PARAMETER','DEFAULT_PARAMETER');
  inh('PHP_INSTANCE_FIELD','DEFAULT_INSTANCE_FIELD');
  inh('PHP_STRING','DEFAULT_STRING');
  inh('PHP_IDENTIFIER','DEFAULT_IDENTIFIER');
  at('PHP_CONCATENATION',{FOREGROUND:h('synOperator')});
  inh('PHP_EXEC_COMMAND_ID','DEFAULT_STRING');
  at('PHP_HEREDOC_ID',{FOREGROUND:h('synKeyword')});
  inh('PHP_HEREDOC_CONTENT','DEFAULT_STRING');
  at('PHP_PREDEFINED SYMBOL',{FOREGROUND:h('synConstant')});
  at('PHP_ATTRIBUTE',{FOREGROUND:h('synMetadata')});
  at('PHP_NAMED_ARGUMENT',{FOREGROUND:h('synVariable'),FONT_TYPE:'2'});
  at('PHP_PRIMITIVE_TYPE_HINT',{FOREGROUND:h('synKeyword')});
  at('MAGIC_MEMBER_ACCESS',{FOREGROUND:h('synVariable'),FONT_TYPE:'2'});
  at('BLADE_DIRECTIVE',{FOREGROUND:h('synKeyword'),FONT_TYPE:'1'});
  at('BLADE_TEXT_BLOCK_BOUNDARY',{FOREGROUND:h('synMetadata')});
  [['TWIG_KEYWORD','synKeyword',null],['TWIG_IDENTIFIER','synVariable',null],
   ['TWIG_STRING','synString',null],['TWIG_NUMBER','synNumber',null],
   ['TWIG_COMMENT','synComment','2'],['TWIG_BRACKETS','synMetadata',null],
   ['TWIG_OPERATION_SIGN','synOperator',null],['TWIG_BAD_CHARACTER','synInvalid',null]]
   .forEach(([k,t2,ft])=>at(k,ft?{FOREGROUND:hx(t2),FONT_TYPE:ft}:{FOREGROUND:hx(t2)}));
  [['HTML_TAG','synPunct'],['HTML_TAG_NAME','synKeyword'],['HTML_ATTRIBUTE_NAME','synMetadata'],
   ['HTML_ATTRIBUTE_VALUE','synString'],['HTML_ENTITY_REFERENCE','synConstant'],
   ['XML_TAG','synPunct'],['XML_TAG_NAME','synKeyword'],['XML_ATTRIBUTE_NAME','synMetadata'],
   ['XML_ATTRIBUTE_VALUE','synString'],['XML_ENTITY_REFERENCE','synConstant'],
   ['XML_NS_PREFIX','synType'],['XML_PROLOGUE','synComment'],['TAG_ATTR_KEY','synMetadata']]
   .forEach(([k,t2])=>at(k,{FOREGROUND:hx(t2)}));
  [['CSS.IDENT','synType',null],['CSS.TAG_NAME','synKeyword',null],['CSS.PROPERTY_NAME','synVariable',null],
   ['CSS.PROPERTY_VALUE','synString',null],['CSS.KEYWORD','synKeyword',null],['CSS.FUNCTION','synFunction',null],
   ['CSS.STRING','synString',null],['CSS.NUMBER','synNumber',null],['CSS.COLOR','synConstant',null],
   ['CSS.HASH','synType',null],['CSS.PSEUDO','synMetadata',null],['CSS.URL','synString',null],
   ['CSS.IMPORTANT','semError','1'],['CSS.COMMENT','synComment','2'],['SASS_VARIABLE','synVariable',null],
   ['SASS_MIXIN','synFunction',null],['SASS_IDENTIFIER','synType',null],['LESS_VARIABLE','synVariable',null],
   ['STYLUS_VARIABLE','synVariable',null]]
   .forEach(([k,t2,ft])=>at(k,ft?{FOREGROUND:hx(t2),FONT_TYPE:ft}:{FOREGROUND:hx(t2)}));
  inh('SASS_COMMENT','CSS.COMMENT');
  [['JS.KEYWORD','synKeyword','1'],['JS.STRING','synString',null],['JS.NUMBER','synNumber',null],
   ['JS.REGEXP','synConstant',null],['JS.LINE_COMMENT','synComment','2'],['JS.BLOCK_COMMENT','synComment','2'],
   ['JS.DOC_COMMENT','synComment','2'],['JS.VALID_STRING_ESCAPE','synConstant',null],
   ['JS.INVALID_STRING_ESCAPE','synInvalid',null],['JS.LOCAL_VARIABLE','synVariable',null],
   ['JS.GLOBAL_VARIABLE','synVariable','2'],['JS.GLOBAL_FUNCTION','synFunction',null],
   ['JS.PARAMETER','synVariable',null],['JS.INSTANCE_MEMBER_FUNCTION','synFunction',null],
   ['JS.STATIC_MEMBER_FUNCTION','synFunction','2'],['JS.ATTRIBUTE','synMetadata',null],
   ['JS.MODULE_NAME','synType',null],['TS.PARAMETER','synVariable',null],
   ['TS.GLOBAL_VARIABLE','synVariable',null],['TS.MODULE_NAME','synType',null],
   ['TS.TYPE_PARAMETER','synType',null],['TS.TYPE_GUARD','synKeyword',null]]
   .forEach(([k,t2,ft])=>at(k,ft?{FOREGROUND:hx(t2),FONT_TYPE:ft}:{FOREGROUND:hx(t2)}));
  at('JS.INSTANCE_MEMBER_VARIABLE',{FOREGROUND:m('synVariable','synType',0.45)});
  at('JS.STATIC_MEMBER_VARIABLE',{FOREGROUND:m('synVariable','synType',0.45)});
  at('JS.EXPORTED.VARIABLE',{FOREGROUND:h('synVariable')});
  inh('JS.DOC_TAG','DEFAULT_DOC_COMMENT_TAG');
  inh('JS.DOC_MARKUP','DEFAULT_DOC_MARKUP');
  [['JSON.KEYWORD','synKeyword'],['JSON.STRING','synString'],['JSON.NUMBER','synNumber'],
   ['JSON.PROPERTY_KEY','synType'],['JSON.BRACES','synPunct'],['JSON.BRACKETS','synPunct'],
   ['JSON.COLON','synPunct'],['JSON.COMMA','synPunct'],['JSON.VALID_ESCAPE','synConstant']]
   .forEach(([k,t2])=>at(k,{FOREGROUND:hx(t2)}));
  [['YAML_SCALAR_KEY','synType',null],['YAML_SCALAR_VALUE','synString',null],
   ['YAML_SCALAR_STRING','synString',null],['YAML_SCALAR_DSTRING','synString',null],
   ['YAML_SCALAR_LIST','synString',null],['YAML_TEXT','fgDefault',null],
   ['YAML_COMMENT','synComment','2'],['YAML_ANCHOR','synConstant',null],['YAML_SIGN','synPunct',null]]
   .forEach(([k,t2,ft])=>at(k,ft?{FOREGROUND:hx(t2),FONT_TYPE:ft}:{FOREGROUND:hx(t2)}));
  for(let i=1;i<=6;i++) at('MARKDOWN_HEADER_LEVEL_'+i,{FOREGROUND:h('synKeyword'),FONT_TYPE:'1'});
  at('MARKDOWN_BOLD',{FOREGROUND:h('fgDefault'),FONT_TYPE:'1'});
  at('MARKDOWN_ITALIC',{FOREGROUND:h('fgDefault'),FONT_TYPE:'2'});
  at('MARKDOWN_CODE_SPAN',{FOREGROUND:h('synString')});
  at('MARKDOWN_CODE_SPAN_MARKER',{FOREGROUND:h('synPunct')});
  at('MARKDOWN_CODE_FENCE',{BACKGROUND:m('fgDefault','bgEditor',0.96)});
  at('MARKDOWN_LINK_TEXT',{FOREGROUND:h('fgLink')});
  at('MARKDOWN_LINK_LABEL',{FOREGROUND:h('synType')});
  at('MARKDOWN_LINK_TITLE',{FOREGROUND:h('synString')});
  at('MARKDOWN_LINK_DESTINATION',{FOREGROUND:h('synComment'),EFFECT_COLOR:h('synComment'),EFFECT_TYPE:'1'});
  at('MARKDOWN_AUTO_LINK',{FOREGROUND:h('fgLink'),EFFECT_COLOR:h('fgLink'),EFFECT_TYPE:'1'});
  at('MARKDOWN_TABLE_SEPARATOR',{FOREGROUND:h('synPunct')});
  [['REGEXP.META','synKeyword'],['REGEXP.BRACES','synPunct'],['REGEXP.BRACKETS','synPunct'],
   ['REGEXP.PARENTHS','synPunct'],['REGEXP.COMMA','synPunct'],['REGEXP.CHAR_CLASS','synConstant'],
   ['REGEXP.ESC_CHARACTER','synConstant'],['REGEXP.QUOTE_CHARACTER','synPunct'],
   ['REGEXP.INVALID_STRING_ESCAPE','synInvalid'],['REGEXP.REDUNDANT_ESCAPE','synComment'],
   ['PROPERTIES.KEY','synType'],['PROPERTIES.KEY_VALUE_SEPARATOR','synPunct'],
   ['PROPERTIES.VALID_STRING_ESCAPE','synConstant'],['PROPERTIES.INVALID_STRING_ESCAPE','synInvalid'],
   ['DOCKER_KEYWORD','synKeyword'],['DOCKER_VARIABLE','synVariable'],['INI.SECTION','synType'],
   ['EDITORCONFIG_VARIABLE','synVariable'],['SQL_OUTER_QUERY_COLUMN','synType'],
   ['GRID_ERROR_VALUE','semError'],['HTTP_REQUEST_PARAMETER_NAME','synMetadata'],
   ['HTTP_REQUEST_PARAMETER_VALUE','synString'],['HTTP_REQUEST_VARIABLE_BRACES','synPunct']]
   .forEach(([k,t2])=>at(k,{FOREGROUND:hx(t2)}));
  at('REGEXP_MATCHED_GROUPS',{BACKGROUND:m('accentPrimary','bgEditor',0.85)});

  /* Comment italics and keyword bold are the two font-style choices anyone
     actually has an opinion about; everything else keeps its designed weight. */
  for(const e of A){
    if(!e.v || Object.keys(e.v).length===0) continue;
    if(COMMENT_ATTRS.has(e.name)){
      if(o.italicComments) e.v.FONT_TYPE='2'; else delete e.v.FONT_TYPE;
    }
    if(KEYWORD_ATTRS.has(e.name)){
      if(o.boldKeywords) e.v.FONT_TYPE='1'; else delete e.v.FONT_TYPE;
    }
  }

  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const out=['<?xml version="1.0" encoding="UTF-8"?>',
    `<scheme name="${esc(meta.name)}" version="142" parent_scheme="${res.isDark?'Darcula':'Default'}">`,
    '  <metaInfo>','    <property name="ide">PhpStorm</property>',
    `    <property name="originalScheme">${esc(meta.name)}</property>`,
    '    <property name="generator">phpstorm-theme-generator</property>','  </metaInfo>',''];

  /* Font settings override the user's own choice, so they are opt-in only. */
  if(o.font){
    const f=o.font;
    if(f.editor)       out.push(`  <option name="EDITOR_FONT_NAME" value="${esc(f.editor)}" />`);
    if(f.editorSize)   out.push(`  <option name="EDITOR_FONT_SIZE" value="${f.editorSize}" />`);
    if(f.lineSpacing)  out.push(`  <option name="LINE_SPACING" value="${f.lineSpacing}" />`);
    if(f.ligatures!=null) out.push(`  <option name="EDITOR_LIGATURES" value="${f.ligatures?'true':'false'}" />`);
    if(f.console)      out.push(`  <option name="CONSOLE_FONT_NAME" value="${esc(f.console)}" />`);
    if(f.consoleSize)  out.push(`  <option name="CONSOLE_FONT_SIZE" value="${f.consoleSize}" />`);
    out.push('');
  }
  out.push('  <colors>');
  for(const [k,v] of COLORS) out.push(`    <option name="${esc(k)}" value="${v}" />`);
  out.push('  </colors>','','  <attributes>');
  for(const e of A){
    if(e.base){ out.push(`    <option name="${esc(e.name)}" baseAttributes="${e.base}" />`); continue; }
    const keys=Object.keys(e.v);
    if(keys.length===0){ out.push(`    <option name="${esc(e.name)}"><value /></option>`); continue; }
    out.push(`    <option name="${esc(e.name)}">`,'      <value>');
    for(const kk of keys) out.push(`        <option name="${kk}" value="${e.v[kk]}" />`);
    out.push('      </value>','    </option>');
  }
  out.push('  </attributes>','</scheme>','');
  return out.join('\n');
}
