// Part of phpstorm-theme-generator — see LICENSE.
package forge;

import com.intellij.ide.IconProvider;
import com.intellij.ide.projectView.ProjectView;
import com.intellij.ide.ui.LafManager;
import com.intellij.ide.ui.LafManagerListener;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.project.ProjectManager;
import com.intellij.openapi.util.IconLoader;
import com.intellij.psi.PsiDirectory;
import com.intellij.psi.PsiElement;
import com.intellij.psi.PsiFile;
import com.intellij.ui.IconDeferrer;

import javax.swing.Icon;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * File and folder icons for a generated theme plugin.
 *
 * Deliberately knows nothing: every rule comes from /forge-icons.properties in
 * the same jar, so the generator can change icons and associations without
 * this class ever being recompiled.
 *
 *   name.<file name>      exact file name           name.composer.json
 *   ext.<extension>       longest extension wins    ext.blade.php before ext.php
 *   dir.<folder name>     exact folder name         dir.tests
 *   dir.*                 every other folder
 *   theme.<n>             a theme of this plugin    theme.0=Forge Dark
 *
 * Rule keys are lower-case; their values are icon paths inside the jar. The
 * file is UTF-8. Icons are only served while one of the listed themes is
 * active, so installing the plugin does not redecorate somebody else's theme.
 *
 * The class is registered twice in plugin.xml - as the icon provider and as a
 * theme-change listener - so that the whole feature stays one class file. The
 * IDE makes a separate instance for each role; they share nothing.
 */
public final class ForgeIconProvider extends IconProvider implements LafManagerListener {
  private final Properties rules = new Properties();
  private final Set<String> themes = new HashSet<>();
  private final ConcurrentHashMap<String, Icon> cache = new ConcurrentHashMap<>();

  public ForgeIconProvider() {
    try (InputStream in = ForgeIconProvider.class.getResourceAsStream("/forge-icons.properties")) {
      if (in != null) rules.load(new InputStreamReader(in, StandardCharsets.UTF_8));
    } catch (Exception ignored) {
      // No rules means no icons of ours; the IDE falls back to its own.
    }
    for (String key : rules.stringPropertyNames())
      if (key.startsWith("theme.")) themes.add(rules.getProperty(key));
  }

  /**
   * The IDE caches tree icons and only asks again when a node is redrawn, so
   * without this a theme switch would leave the old icons up until then.
   */
  @Override
  public void lookAndFeelChanged(LafManager source) {
    try {
      IconDeferrer.getInstance().clearCache();
      for (Project project : ProjectManager.getInstance().getOpenProjects())
        if (!project.isDisposed()) ProjectView.getInstance(project).refresh();
    } catch (Throwable ignored) {
      // Cosmetic: the icons still catch up the next time the tree redraws.
    }
  }

  private boolean ownThemeActive() {
    if (themes.isEmpty()) return true;
    try {
      var laf = LafManager.getInstance().getCurrentUIThemeLookAndFeel();
      return laf != null && themes.contains(laf.getName());
    } catch (Throwable missingApi) {
      // An IDE without this call: better our icons everywhere than none at all.
      return true;
    }
  }

  @Override
  public Icon getIcon(PsiElement element, int flags) {
    if (!(element instanceof PsiDirectory) && !(element instanceof PsiFile)) return null;
    if (!ownThemeActive()) return null;
    String path = null;
    if (element instanceof PsiDirectory) {
      String name = ((PsiDirectory) element).getName().toLowerCase();
      path = rules.getProperty("dir." + name);
      if (path == null) path = rules.getProperty("dir.*");
    } else if (element instanceof PsiFile) {
      String name = ((PsiFile) element).getName().toLowerCase();
      path = rules.getProperty("name." + name);
      for (int dot = name.indexOf('.'); path == null && dot >= 0; dot = name.indexOf('.', dot + 1))
        path = rules.getProperty("ext." + name.substring(dot + 1));
    }
    if (path == null) return null;
    return cache.computeIfAbsent(path,
        p -> IconLoader.getIcon(p, ForgeIconProvider.class.getClassLoader()));
  }
}
