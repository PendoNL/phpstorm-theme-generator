// Part of phpstorm-theme-generator — see LICENSE.
/**
 * Emits a *.theme.json — the IDE chrome. ~790 leaf UI keys.
 *
 * Rule that everything hangs on: never write a raw hex into a `ui` key. Every
 * colour goes into `colors` as a named token and every key references it by
 * name, which is what makes a variant a seed change rather than a rewrite.
 */
import { mix, alpha, lighten, rotate, noHash } from './color.js';
import { applyStyleOptions, monochromeIconPalette, resolveOptions } from './options.js';
import { fileIconPalette } from './file-icons.js';

export function buildThemeJson(res,meta,options={}){
  const T=res.T;
  const M=(a,b,t)=>mix(T[a],T[b],t);
  const A=(k,a)=>alpha(T[k],a);
  const border=k=>'1,1,1,1,'+noHash(T[k]).toUpperCase();
  const colors={};
  for(const k of Object.keys(T)) colors[k]=T[k];

  const ui={};
  ui['*']={background:'bgBase',foreground:'fgDefault',textForeground:'fgDefault',
    caretForeground:'fgDefault',infoForeground:'fgSubtle',disabledForeground:'fgDisabled',
    disabledText:'fgDisabled',inactiveForeground:'fgMuted',
    selectionBackground:'bgSelectionUi',selectionForeground:'fgSelection',
    selectionInactiveBackground:'bgSelectionInactive',selectionBackgroundInactive:'bgSelectionInactive',
    selectionInactiveForeground:'fgSelection',selectionForegroundInactive:'fgSelection',
    inactiveBackground:'bgBase',disabledBackground:'bgBase',
    borderColor:'borderDefault',separatorColor:'separator',
    acceleratorForeground:'fgSubtle',acceleratorSelectionForeground:'fgSelection'};
  ui.Panel={background:'bgBase',foreground:'fgDefault'};
  ui.Viewport={background:'bgBase',foreground:'fgDefault'};
  ui.ScrollPane={background:'bgBase',foreground:'fgDefault'};
  ui.Label={background:'bgBase',foreground:'fgDefault',disabledForeground:'fgDisabled',
    disabledText:'fgDisabled',selectedForeground:'fgSelection',infoForeground:'fgSubtle',
    errorForeground:'semError',warningForeground:'semWarning',successForeground:'semSuccess'};
  ui.OptionPane={background:'bgOverlay',foreground:'fgDefault',messageForeground:'fgDefault'};
  ui.AlertDialog={background:'bgOverlay'};
  ui.SplitPane={background:'bgBase'};
  ui.SplitPaneDivider={draggingColor:'accentPrimary'};
  ui.OnePixelDivider={background:'separator'};
  ui.Separator={separatorColor:'separator'};
  ui.Group={separatorColor:'separator',disabledSeparatorColor:'separator'};
  ui.Borders={color:'borderDefault',ContrastBorderColor:'borderStrong'};
  ui.TitledBorder={titleColor:'fgMuted'};
  ui.Window={border:border('borderDefault'),undecorated:{border:border('borderDefault')}};
  ui.Component={borderColor:'borderDefault',disabledBorderColor:'borderDisabled',
    focusedBorderColor:'accentPrimary',focusColor:'focusRing',errorFocusColor:'errRing',
    inactiveErrorFocusColor:'errRingWeak',warningFocusColor:'warnRing',
    inactiveWarningFocusColor:'warnRingWeak',iconColor:'fgSubtle',hoverIconColor:'fgDefault',
    infoForeground:'fgSubtle',arc:6,focusWidth:2};
  for(const f of ['TextField','TextArea','TextPane','EditorPane','FormattedTextField','PasswordField'])
    ui[f]={background:'bgEditor',foreground:'fgDefault',caretForeground:'caret',
      inactiveForeground:'fgDisabled',selectionBackground:'bgSelection',selectionForeground:'fgSelection'};
  ui.PasswordField.capsLockIconColor='semWarning';
  ui.TextComponent={selectionBackgroundInactive:'bgSelectionInactive'};
  ui.SearchField={errorBackground:'tintErrorRaised',errorForeground:'semError'};
  ui.Button={background:'bgRaised',foreground:'fgDefault',startBackground:'bgRaised',
    endBackground:'bgRaised',startBorderColor:'borderDefault',endBorderColor:'borderDefault',
    focusedBorderColor:'accentPrimary',disabledBorderColor:'borderDisabled',
    disabledText:'fgDisabled',shadowColor:'transparent',shadowWidth:0,arc:6,
    loadingForeground:'fgSubtle',
    default:{foreground:'fgInverse',startBackground:'accentPrimary',endBackground:'accentPrimary',
      startBorderColor:'accentPrimary',endBorderColor:'accentPrimary',focusColor:'focusRing',
      focusedBorderColor:'accentPrimaryHover',shadowColor:'transparent',loadingForeground:'fgInverse'},
    Split:{default:{separatorColor:'borderStrong',iconColor:'fgInverse'}}};
  ui.OptionButton={separatorColor:'borderDefault',default:{separatorColor:'borderStrong'}};
  ui.ToggleButton={background:'bgRaised',foreground:'fgDefault',disabledText:'fgDisabled',
    onBackground:'semSuccess',onForeground:'fgInverse',offBackground:'fgDisabled',
    offForeground:'fgMuted',buttonColor:'bgRaised',borderColor:'borderDefault'};
  ui.ActionButton={hoverBackground:'bgHover',hoverBorderColor:'transparent',
    pressedBackground:'bgPress',pressedBorderColor:'transparent',
    focusedBorderColor:'accentPrimary',separatorColor:'separator',hoverSeparatorColor:'borderDefault'};
  ui.SegmentedButton={selectedButtonColor:'bgRaised',focusedSelectedButtonColor:'bgHover',
    selectedStartBorderColor:'borderDefault',selectedEndBorderColor:'borderDefault'};
  ui.DisclosureButton={defaultBackground:'bgRaised',hoverOverlay:A('fgDefault',0.06),
    pressedOverlay:A('fgDefault',0.10)};
  ui.CheckBox={background:'bgBase',foreground:'fgDefault',disabledText:'fgDisabled',select:'accentPrimary'};
  ui.RadioButton={background:'bgBase',foreground:'fgDefault',disabledText:'fgDisabled'};
  ui.ComboBox={background:'bgRaised',foreground:'fgDefault',nonEditableBackground:'bgRaised',
    disabledForeground:'fgDisabled',modifiedItemForeground:'accentSecondary',
    selectionBackground:'bgSelectionUi',selectionForeground:'fgSelection',
    ArrowButton:{background:'bgRaised',nonEditableBackground:'bgRaised',
      iconColor:'fgSubtle',disabledIconColor:'fgDisabled'}};
  ui.ComboBoxButton={background:'bgRaised'};
  ui.Spinner={background:'bgRaised'};
  ui.Slider={background:'bgBase',foreground:'fgDefault',buttonColor:'accentPrimary',
    buttonBorderColor:'accentPrimary',trackColor:'trackNeutral',tickColor:'fgSubtle',focus:'focusRing'};
  ui.Tree={background:'bgBase',foreground:'fgDefault',selectionBackground:'bgSelectionUi',
    selectionForeground:'fgSelection',selectionInactiveBackground:'bgSelectionInactive',
    hoverBackground:'bgHover',hoverInactiveBackground:'bgHover',
    modifiedItemForeground:'accentSecondary',errorForeground:'semError',hash:'guideIndent',
    paintLines:false,rowHeight:24,forceFocusedSelectionForeground:'fgSelection',Selection:{arc:6}};
  ui.List={background:'bgBase',foreground:'fgDefault',selectionBackground:'bgSelectionUi',
    selectionForeground:'fgSelection',selectionInactiveBackground:'bgSelectionInactive',
    selectionInactiveForeground:'fgSelection',hoverBackground:'bgHover',
    hoverInactiveBackground:'bgHover',dropLineColor:'accentPrimary',rowHeight:22,
    Button:{hoverBackground:'bgHover',separatorColor:'separator'},
    Line:{hoverBackground:'bgHover'},
    Tag:{background:'tintAccentSoft',foreground:'accentPrimary'}};
  ui.Table={background:'bgBase',foreground:'fgDefault',gridColor:'separator',
    selectionBackground:'bgSelectionUi',selectionForeground:'fgSelection',
    selectionInactiveBackground:'bgSelectionInactive',selectionInactiveForeground:'fgSelection',
    hoverBackground:'bgHover',hoverInactiveBackground:'bgHover',
    focusCellBackground:'bgSelectionUi',focusCellForeground:'fgSelection',
    lightSelectionBackground:'tintAccentWeak',lightSelectionForeground:'fgDefault',
    lightSelectionInactiveBackground:'tintAccentWeak',lightSelectionInactiveForeground:'fgMuted',
    alternativeRowBackground:'stripeRow',stripeColor:'stripeRow',
    dropLineColor:'accentPrimary',dropLineShortColor:'accentPrimary',sortIconColor:'fgSubtle'};
  ui.TableHeader={background:'bgSunken',foreground:'fgMuted',separatorColor:'separator',
    bottomSeparatorColor:'separator',focusCellBackground:'bgHover'};
  ui.SettingsTree={rowHeight:24};
  ui.SidePanel={background:'bgSunken'};
  ui.DragAndDrop={areaBackground:'tintAccentWeak',areaForeground:'accentPrimary',
    borderColor:'accentPrimary',rowBackground:'tintAccentSoft'};
  ui.ToolWindow={background:'bgBase',borderColor:'borderDefault',
    Header:{background:'bgSunken',inactiveBackground:'bgSunken',borderColor:'borderDefault',height:30},
    HeaderCloseButton:{background:'bgHover'},
    HeaderTab:{underlineColor:'accentPrimary',inactiveUnderlineColor:'accentPrimaryMuted',
      underlineHeight:2,underlinedTabBackground:'bgHover',underlinedTabInactiveBackground:'bgBase',
      hoverBackground:'bgHover',hoverInactiveBackground:'bgHover',selectedInactiveBackground:'bgBase'},
    Button:{foreground:'fgMuted',hoverBackground:'bgHover',selectedBackground:'bgSelectionUi',
      selectedForeground:'fgSelection',
      DragAndDrop:{buttonDropBackground:'tintAccentSoft',buttonDropBorderColor:'accentPrimary',
        buttonFloatingBackground:'bgRaised'}},
    DragAndDrop:{areaBackground:'tintAccentWeak'},
    Stripe:{background:'bgSunken',borderColor:'borderDefault',separatorColor:'separator',
      DragAndDrop:{separatorColor:'accentPrimary'}}};
  ui.StripeToolbar={Button:{size:30,iconSize:20}};
  ui.EditorTabs={background:'bgSunken',borderColor:'borderDefault',
    underTabsBorderColor:'borderDefault',underlinedBorderColor:'accentPrimary',
    underlineColor:'accentPrimary',inactiveUnderlineColor:'accentPrimaryMuted',
    underlineHeight:2,underlineArc:2,underlinedTabBackground:'bgEditor',
    underlinedTabForeground:'fgDefault',inactiveUnderlinedTabBackground:'bgBase',
    inactiveUnderlinedTabBorderColor:'borderDefault',hoverBackground:'bgHover',
    hoverInactiveBackground:'bgHover',hoverSelectedBackground:'bgHover',
    hoverSelectedInactiveBackground:'bgHover',unselectedAlpha:0.75,unselectedBlend:0.75};
  ui.DefaultTabs={background:'bgSunken',borderColor:'borderDefault',hoverBackground:'bgHover',
    underlineColor:'accentPrimary',inactiveUnderlineColor:'accentPrimaryMuted',underlineHeight:2,
    underlinedTabBackground:'bgBase',underlinedTabForeground:'fgDefault'};
  ui.DebuggerTabs={underlinedTabBackground:'bgBase',underlineHeight:2};
  ui.TabbedPane={background:'bgBase',foreground:'fgDefault',contentAreaColor:'borderDefault',
    disabledForeground:'fgDisabled',disabledUnderlineColor:'fgDisabled',focusColor:'bgHover',
    hoverColor:'bgHover',underlineColor:'accentPrimary',tabSelectionHeight:2};
  ui.MainWindow={Tab:{background:'bgSunken',foreground:'fgMuted',selectedBackground:'bgEditor',
    selectedForeground:'fgDefault',selectedInactiveBackground:'bgBase',hoverBackground:'bgHover',
    hoverForeground:'fgDefault',separatorColor:'separator',borderColor:'borderDefault'}};
  ui.FileColor={Blue:A('semInfo',0.14),Green:A('semSuccess',0.14),Orange:A('semWarning',0.14),
    Rose:A('semError',0.14),Violet:A('synConstant',0.14),Yellow:A('accentSecondary',0.14),
    Gray:A('fgSubtle',0.14)};
  ui.MenuBar={borderColor:'borderDefault',foreground:'fgDefault',disabledForeground:'fgDisabled',
    disabledBackground:'bgSunken',selectionBackground:'bgSelectionUi',selectionForeground:'fgSelection',
    highlight:'borderDefault',shadow:'borderDefault'};
  ui.Menu={background:'bgRaised',foreground:'fgDefault',borderColor:'borderDefault',
    separatorColor:'separator',disabledBackground:'bgRaised',disabledForeground:'fgDisabled',
    selectionBackground:'bgSelectionUi',selectionForeground:'fgSelection',
    acceleratorForeground:'fgSubtle',acceleratorSelectionForeground:'fgSelection',Selection:{arc:6}};
  for(const k of ['MenuItem','CheckBoxMenuItem','RadioButtonMenuItem'])
    ui[k]={background:'bgRaised',foreground:'fgDefault',disabledBackground:'bgRaised',
      disabledForeground:'fgDisabled',selectionBackground:'bgSelectionUi',
      selectionForeground:'fgSelection',acceleratorForeground:'fgSubtle'};
  ui.CheckBoxMenuItem.acceleratorSelectionForeground='fgSelection';
  ui.RadioButtonMenuItem.acceleratorSelectionForeground='fgSelection';
  ui.PopupMenu={background:'bgRaised',foreground:'fgDefault',selectionBackground:'bgSelectionUi',
    selectionForeground:'fgSelection',translucentBackground:A('bgRaised',0.96),borderWidth:1,
    Selection:{arc:6}};
  ui.PopupMenuSeparator={height:9,stripeWidth:1,stripeIndent:4};
  ui.MainMenu={selectionBackground:'bgSelectionUi',selectionForeground:'fgSelection',
    transparentSelectionBackground:A('fgDefault',0.10),Selection:{fullScreenArc:6}};
  ui.Popup={background:'bgRaised',borderColor:'borderDefault',inactiveBorderColor:'borderDefault',
    innerBorderColor:'borderDefault',borderWidth:1,paintBorder:true,separatorColor:'separator',
    separatorForeground:'fgSubtle',
    Header:{activeBackground:'bgSunken',inactiveBackground:'bgSunken',
      activeForeground:'fgDefault',inactiveForeground:'fgMuted'},
    Toolbar:{background:'bgRaised',borderColor:'borderDefault'},
    Advertiser:{background:'bgSunken',foreground:'fgSubtle',borderColor:'borderDefault'},
    Selection:{arc:6}};
  ui.CompletionPopup={foreground:'fgDefault',selectionBackground:'bgSelectionUi',
    selectionInactiveBackground:'bgSelectionInactive',matchForeground:'accentPrimary',
    nonFocusedMask:A('bgBase',0.35),Advertiser:{background:'bgSunken',foreground:'fgSubtle'}};
  ui.ComplexPopup={Header:{background:'bgSunken'}};
  ui.ToolTip={background:'bgRaised',foreground:'fgDefault',borderColor:'borderDefault',
    infoForeground:'fgSubtle',linkForeground:'accentPrimary',shortcutForeground:'fgSubtle',
    paintBorder:true,Actions:{background:'bgSunken',infoForeground:'fgSubtle'}};
  ui.Tooltip={separatorColor:'separator'};
  ui.HelpTooltip={borderColor:'borderDefault'};
  ui.InformationHint={borderColor:'borderDefault'};
  ui.DebuggerPopup={borderColor:'borderDefault'};
  ui.InplaceRefactoringPopup={borderColor:'accentPrimary'};
  ui.GutterTooltip={infoForeground:'fgSubtle',lineSeparatorColor:'separator'};
  ui.ValidationTooltip={errorBackground:'tintErrorRaised',errorForeground:'semError',
    errorBorderColor:'semError',warningBackground:'tintWarnRaised',
    warningForeground:'semWarning',warningBorderColor:'semWarning'};
  ui.ParameterInfo={background:'bgRaised',foreground:'fgDefault',borderColor:'borderDefault',
    infoForeground:'fgSubtle',disabledForeground:'fgDisabled',
    currentParameterForeground:'accentPrimary',currentOverloadBackground:'bgHover',
    lineSeparatorColor:'separator'};
  ui.SpeedSearch={background:'bgRaised',foreground:'fgDefault',borderColor:'borderDefault',
    errorForeground:'semError'};
  const sb={background:'bgBase'};
  for(const p of ['','Transparent.','Mac.','Mac.Transparent.']){
    sb[p+'thumbColor']='sbThumb'; sb[p+'thumbBorderColor']='sbThumb';
    sb[p+'hoverThumbColor']='sbThumbHover'; sb[p+'hoverThumbBorderColor']='sbThumbHover';
    sb[p+'trackColor']='sbTrack'; sb[p+'hoverTrackColor']='sbTrackHover';
  }
  ui.ScrollBar=sb;
  ui['Scrollbar.Tabs.ThumbColor']='sbThumb';
  ui['Scrollbar.Tabs.HoveredThumbColor']='sbThumbHover';
  ui['Scrollbar.Tabs.TransparentThumbColor']='sbThumb';
  ui.StatusBar={background:'bgSunken',borderColor:'borderDefault',
    Widget:{foreground:'fgMuted',hoverBackground:'bgHover',hoverForeground:'fgDefault',
      pressedBackground:'bgPress'},
    Breadcrumbs:{foreground:'fgMuted',hoverForeground:'fgDefault',hoverBackground:'bgHover',
      pressedBackground:'bgPress',selectionBackground:'bgSelectionUi',
      selectionInactiveBackground:'bgSelectionInactive'}};
  ui.ToolBar={background:'bgSunken',foreground:'fgDefault',separatorColor:'separator',
    borderHandleColor:'borderDefault'};
  ui.Toolbar={Floating:{background:'bgRaised',borderColor:'borderDefault'}};
  ui.MainToolbar={background:'bgSunken',separatorColor:'separator',Button:{size:34,iconSize:20}};
  ui.NavBar={borderColor:'borderDefault',borderWidth:1};
  ui.TitlePane={background:'bgSunken',inactiveBackground:'bgSunken',infoForeground:'fgMuted',
    inactiveInfoForeground:'fgDisabled',Button:{hoverBackground:'bgHover'}};
  ui.MemoryIndicator={usedBackground:'accentPrimaryMuted',allocatedBackground:'trackNeutral'};
  ui.RunWidget={foreground:'fgInverse',iconColor:'fgInverse',runIconColor:'fgInverse',
    runningBackground:'semSuccess',runningIconColor:'fgInverse',stopBackground:'semError',
    hoverBackground:A('fgInverse',0.12),pressedBackground:A('fgInverse',0.20)};
  ui.RunToolbar={Run:{activeBackground:M('semSuccess','bgSunken',0.75)},
    Debug:{activeBackground:M('semInfo','bgSunken',0.75)},
    Profile:{activeBackground:M('accentSecondary','bgSunken',0.75)}};
  ui.ProgressBar={background:'trackNeutral',foreground:'accentPrimary',progressColor:'accentPrimary',
    trackColor:'trackNeutral',indeterminateStartColor:'accentPrimaryMuted',
    indeterminateEndColor:'accentPrimary',selectionBackground:'fgDefault',
    selectionForeground:'fgInverse',failedColor:'semError',failedEndColor:M('semError','bgBase',0.4),
    passedColor:'semSuccess',passedEndColor:M('semSuccess','bgBase',0.4),
    warningColor:'semWarning',warningEndColor:M('semWarning','bgBase',0.4)};
  ui.ProgressIcon={color:'accentPrimary'};
  ui.Link={activeForeground:'accentPrimary',hoverForeground:'accentPrimaryHover',
    pressedForeground:'accentPrimaryHover',visitedForeground:'accentPrimaryMuted',
    secondaryForeground:'fgSubtle',focusedBorderColor:'accentPrimary'};
  ui.Counter={background:'accentPrimary',foreground:'fgInverse'};
  ui.Tag={background:'tintAccentSoft',foreground:'accentPrimary'};
  ui.Abbreviation={background:'tintAccentSoft',foreground:'accentPrimary',borderColor:'borderDefault'};
  ui.IconBadge={errorBackground:'semError',warningBackground:'semWarning',
    infoBackground:'semInfo',successBackground:'semSuccess'};
  ui.Badge={blueBackground:'semInfo',blueForeground:'fgInverse',greenBackground:'semSuccess',
    greenForeground:'fgInverse',greenOutlineBorderColor:'semSuccess',greenOutlineForeground:'semSuccess',
    disabledBackground:'trackNeutral',disabledForeground:'fgDisabled',
    blueSecondaryBackground:M('semInfo','bgBase',0.80),blueSecondaryForeground:'semInfo',
    greenSecondaryBackground:M('semSuccess','bgBase',0.80),greenSecondaryForeground:'semSuccess',
    graySecondaryBackground:'trackNeutral',graySecondaryForeground:'fgMuted',
    purpleSecondaryBackground:M('synConstant','bgBase',0.80),purpleSecondaryForeground:'synConstant'};
  ui.Notification={background:'bgRaised',foreground:'fgDefault',borderColor:'borderDefault',
    linkForeground:'accentPrimary',errorBackground:'tintErrorRaised',errorBorderColor:'semError',
    errorForeground:'fgDefault',iconHoverBackground:'bgHover',arc:8,
    MoreButton:{background:'bgSunken',foreground:'fgMuted',innerBorderColor:'borderDefault'},
    Button:{background:'bgRaised',foreground:'fgDefault',borderColor:'borderDefault'},
    ToolWindow:{errorBackground:'tintErrorBg',errorBorderColor:'semError',errorForeground:'fgDefault',
      warningBackground:'tintWarnBg',warningBorderColor:'semWarning',warningForeground:'fgDefault',
      informativeBackground:'tintInfoBg',informativeBorderColor:'semInfo',informativeForeground:'fgDefault'}};
  ui.NotificationsToolwindow={newNotification:{background:'tintAccentWeak',hoverBackground:'bgHover'},
    Notification:{hoverBackground:'bgHover'}};
  ui.Banner={infoBackground:'tintInfoBg',infoBorderColor:'semInfo',
    successBackground:'tintSuccessBg',successBorderColor:'semSuccess',
    warningBackground:'tintWarnBg',warningBorderColor:'semWarning',
    errorBackground:'tintErrorBg',errorBorderColor:'semError',
    aiBackground:M('synConstant','bgBase',0.88),aiBorderColor:'synConstant'};
  ui.SearchEverywhere={SearchField:{background:'bgRaised',borderColor:'borderDefault',
      infoForeground:'fgSubtle'},
    Header:{background:'bgRaised'},
    Tab:{selectedBackground:'bgSelectionUi',selectedForeground:'fgSelection'},
    List:{separatorColor:'separator',separatorForeground:'fgSubtle',settingsBackground:'bgSunken'},
    Advertiser:{background:'bgSunken',foreground:'fgSubtle'}};
  ui.SearchMatch={startBackground:'searchMatch',endBackground:'searchMatch'};
  ui.SearchOption={selectedBackground:'bgSelectionUi',selectedHoveredBackground:'bgHover',
    selectedPressedBackground:'bgPress'};
  ui.NewClass={SearchField:{background:'bgRaised'}};
  ui.Editor={background:'bgEditor',foreground:'fgDefault',shortcutForeground:'accentPrimary',
    SearchField:{background:'bgRaised',borderColor:'borderDefault'},
    Toolbar:{borderColor:'borderDefault'},
    ToolTip:{background:'bgRaised',errorBackground:'tintErrorRaised',errorBorder:'semError',
      warningBackground:'tintWarnRaised',warningBorder:'semWarning',
      successBackground:'tintSuccessRaised',successBorder:'semSuccess',
      selectionBackground:'bgSelectionUi',iconHoverBackground:'bgHover'}};
  ui.VersionControl={
    Log:{Commit:{currentBranchBackground:'tintAccentWeak',hoveredBackground:'bgHover',
        selectionBackground:'bgSelectionUi',selectionForeground:'fgSelection',
        selectionInactiveBackground:'bgSelectionInactive',selectionInactiveForeground:'fgSelection',
        unmatchedForeground:'fgDisabled',rowHeight:24,Reference:{foreground:'fgSubtle'}},
      Graph:{saturation:0.6,brightness:0.8}},
    GitLog:{headIconColor:'accentSecondary',localBranchIconColor:'semSuccess',
      remoteBranchIconColor:'semInfo',tagIconColor:'accentSecondary',otherIconColor:'fgSubtle'},
    RefLabel:{foreground:'fgDefault',backgroundBase:'bgRaised',backgroundBrightness:0.6},
    FileHistory:{Commit:{selectedBranchBackground:'tintAccentWeak'}},
    MarkerPopup:{borderColor:'borderDefault',Toolbar:{background:'bgRaised'}},
    Merge:{Status:{NoConflicts:{foreground:'semSuccess'}}}};
  ui.CombinedDiff={BlockBorder:{selectedActiveColor:'accentPrimary',selectedInactiveColor:'borderDefault'}};
  ui.Debugger={Variables:{valueForeground:'fgDefault',typeForeground:'synType',
      changedValueForeground:'accentSecondary',modifyingValueForeground:'accentSecondary',
      collectingDataForeground:'fgSubtle',evaluatingExpressionForeground:'fgSubtle',
      exceptionForeground:'semError',errorMessageForeground:'semError'},
    EvaluateExpression:{background:'bgEditor'}};
  ui.Plugins={background:'bgBase',borderColor:'borderDefault',hoverBackground:'bgHover',
    lightSelectionBackground:'tintAccentWeak',disabledForeground:'fgDisabled',
    SectionHeader:{background:'bgSunken',foreground:'fgMuted'},
    Tab:{hoverBackground:'bgHover',selectedBackground:'bgSelectionUi',selectedForeground:'fgSelection'},
    SearchField:{background:'bgRaised'},
    tagBackground:'trackNeutral',tagForeground:'fgMuted',
    eapTagBackground:M('semWarning','bgBase',0.80),paidTagBackground:M('semSuccess','bgBase',0.80),
    trialTagBackground:M('semInfo','bgBase',0.80),suggestedLabelBackground:'tintAccentSoft',
    Button:{installBackground:'bgRaised',installBorderColor:'semSuccess',
      installForeground:'semSuccess',installFillBackground:'semSuccess',
      installFillForeground:'fgInverse',installFocusedBackground:M('semSuccess','bgRaised',0.75),
      updateBackground:'accentPrimary',updateBorderColor:'accentPrimary',updateForeground:'fgInverse'}};
  ui.WelcomeScreen={background:'bgBase',borderColor:'borderDefault',separatorColor:'separator',
    captionBackground:'bgSunken',captionForeground:'fgDefault',headerBackground:'bgSunken',
    headerForeground:'fgDefault',footerBackground:'bgSunken',footerForeground:'fgMuted',
    groupIconBorderColor:'borderDefault',
    Details:{background:'bgBase'},SidePanel:{background:'bgSunken'},Banner:{background:'bgSunken'},
    Projects:{background:'bgBase',selectionBackground:'bgSelectionUi',
      selectionInactiveBackground:'bgSelectionInactive',
      actions:{background:'bgBase',selectionBackground:'bgSelectionUi',
        selectionBorderColor:'accentPrimary'}},
    LearnTab:{CourseCard:{hover:'bgHover'}}};
  ui.Bookmark={iconBackground:'accentSecondary',Mnemonic:{iconForeground:'fgInverse'},
    MnemonicAvailable:{foreground:'fgMuted',background:'bgRaised',borderColor:'borderDefault'},
    MnemonicAssigned:{foreground:'fgInverse',background:'accentSecondary'},
    MnemonicCurrent:{foreground:'fgInverse',background:'accentPrimary'}};
  ui.GotItTooltip={background:'bgRaised',foreground:'fgDefault',borderColor:'borderDefault',
    linkForeground:'accentPrimary',shortcutForeground:'fgSubtle',shortcutBackground:'bgSunken',
    codeForeground:'synString',codeBackground:'bgSunken',codeBorderColor:'borderDefault',
    stepForeground:'fgSubtle',secondaryActionForeground:'fgMuted',iconFillColor:'accentPrimary',
    iconBorderColor:'accentPrimary',imageBorderColor:'borderDefault',animationBackground:'bgSunken',
    arc:8,Header:{foreground:'fgDefault'},
    Button:{foreground:'fgInverse',startBackground:'accentPrimary',endBackground:'accentPrimary',
      startBorderColor:'accentPrimary',endBorderColor:'accentPrimary',contrastBackground:'bgRaised'}};
  ui.Code={Inline:{backgroundColor:'bgSunken',foregroundColor:'synString',
      borderColor:'borderDefault',borderRadius:4},
    Block:{backgroundColor:'bgSunken',foregroundColor:'fgDefault',borderColor:'borderDefault',
      borderRadius:6,EditorPane:{backgroundColor:'bgEditor',borderColor:'borderDefault'}}};
  ui.Shortcut={background:'bgSunken',foreground:'fgMuted',borderColor:'borderDefault',borderRadius:4};
  ui.Island={borderColor:'borderDefault',arc:12,borderWidth:1,inactiveAlpha:0.7};
  ui.Islands={borderColor:'borderDefault',inactiveAlpha:0.7};
  const shd={borderInsets:'4,4,4,4'};
  for(const d of ['bottom','top','left','right']){shd[d+'0Color']='shadow0';shd[d+'1Color']='shadow1';}
  for(const d of ['bottomLeft','bottomRight','topLeft','topRight']){shd[d+'0Color']='shadowCorner';shd[d+'1Color']='shadow1';}
  ui.Ide={Shadow:{...shd}};
  ui.Notification.Shadow={...shd};

  const pal={
    'Actions.Red':'semError','Actions.Yellow':'semWarning','Actions.Green':'semSuccess',
    'Actions.Blue':'accentPrimary','Actions.Grey':'fgSubtle','Actions.GreyInline':'fgSubtle'
  };
  const ColorPalette={};
  for(const [k,v] of Object.entries(pal)){ ColorPalette[k]=v; ColorPalette[k+'.Dark']=v; }
  Object.assign(ColorPalette,{
    'Objects.Grey':'fgSubtle','Objects.Blue':'accentPrimary','Objects.Green':'semSuccess',
    'Objects.GreenAndroid':'semSuccess','Objects.Yellow':'accentSecondary',
    'Objects.YellowDark':lighten(T.accentSecondary,-0.06),
    'Objects.Purple':'synConstant','Objects.Pink':rotate(T.synConstant,25),
    'Objects.Red':'semError','Objects.RedStatus':'semError','Objects.BlackText':'bgEditor'
  });
  const sfx=res.isDark?'.Dark':'';
  Object.assign(ColorPalette,{
    ['Checkbox.Background.Default'+sfx]:'bgRaised',
    ['Checkbox.Background.Disabled'+sfx]:'bgBase',
    ['Checkbox.Background.Selected'+sfx]:'accentPrimary',
    ['Checkbox.Border.Default'+sfx]:'borderStrong',
    ['Checkbox.Border.Disabled'+sfx]:'borderDefault',
    ['Checkbox.Border.Selected'+sfx]:'accentPrimary',
    ['Checkbox.Foreground.Selected'+sfx]:'fgInverse',
    ['Checkbox.Foreground.Disabled'+sfx]:'fgDisabled',
    ['Checkbox.Focus.Wide'+sfx]:A('accentPrimary',0.45),
    ['Checkbox.Focus.Thin.Default'+sfx]:'accentPrimary',
    ['Checkbox.Focus.Thin.Selected'+sfx]:'accentPrimary',
    ['Tree.iconColor'+sfx]:'fgMuted'
  });

  const o=resolveOptions(options);
  const applied=applyStyleOptions(ui,colors,T,o);
  const iconPalette = o.monochromeIcons ? monochromeIconPalette(ColorPalette,T) : ColorPalette;
  if(o.fileIcons) Object.assign(iconPalette, fileIconPalette(T, o.monochromeIcons ? 'fgMuted' : null));

  const theme={name:meta.name,dark:res.isDark,author:meta.author,
    editorScheme:'/themes/'+meta.slug+'.xml',
    commentary:'Generated by Theme Generator for PhpStorm from 5 seed colours: '+res.seeds.join(' '),
    colors,ui,icons:{ColorPalette:iconPalette},
    iconColorsOnSelection:{[T.fgSubtle]:T.fgSelection,[T.fgMuted]:T.fgSelection},
    ...(applied.background ? {background:applied.background,
                              emptyFrameBackground:applied.emptyFrameBackground} : {})};
  return JSON.stringify(theme,null,2)+'\n';
}
