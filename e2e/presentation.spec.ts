import { expect, test } from '@playwright/test';

test('loads the dashboard and its presentations API', async ({ page }) => {
  const presentationResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/presentations') && response.request().method() === 'GET',
  );

  await page.goto('/feature');
  const response = await presentationResponse;

  expect(response.ok()).toBe(true);
  await expect(page.getByRole('heading', { name: 'Your ideas, ready to become a presentation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Saved presentations' })).toBeVisible();
});

test('keeps every part visible when an image URL is blocked', async ({ page }) => {
  await page.route('**/api/presentations/presentation-demo', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const document = await response.json();
    document.sections[0].sequences[0].imageUrl = 'https://effect.website/';
    await route.fulfill({ response, json: document });
  });

  await page.goto('/editor/presentation-demo');
  await expect(page.getByLabel('Part title')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '+ Add a sequence' })).toHaveCount(2);
});

test('downloads the presentation in Markdown and YouTube formats', async ({ page }) => {
  await page.goto('/editor/presentation-demo');

  const markdownDownload = page.waitForEvent('download');
  await page.getByLabel('Export format').selectOption('markdown');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  expect((await markdownDownload).suggestedFilename()).toBe('les-architectures-distribuees-notes.md');

  const youtubeDownload = page.waitForEvent('download');
  await page.getByLabel('Export format').selectOption('youtube');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  expect((await youtubeDownload).suggestedFilename()).toBe('les-architectures-distribuees-youtube.txt');
});

test('creates a subject, saves speaker notes, and reloads them', async ({ page }) => {
  await page.goto('/feature');
  const title = `E2E subject ${Date.now()}`;

  await page.getByLabel('Presentation title').fill(title);
  await page.getByLabel('Audience').fill('Product team');
  await page.getByLabel('Main objective').fill('Keep the idea available after a reload.');
  await page.getByRole('button', { name: 'Create subject' }).click();
  await page.route('**/api/presentations/*', async (route) => {
    if (route.request().method() === 'GET') {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await route.continue();
  });
  await page.getByRole('link', { name: 'Open the editor →' }).click();

  await expect(page).toHaveURL(/\/editor\//);
  await expect(page.getByLabel('Presentation title')).toHaveValue(title);
  const image = {
    name: 'demo-image.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  };
  await page.locator('input[type="file"]').nth(0).setInputFiles(image);
  await page.getByLabel('Cover image description').fill('Abstract distributed systems network');
  await expect(page.getByRole('button', { name: '+ Add a part' })).toBeVisible();
  await page.getByRole('button', { name: '+ Add a part' }).click();
  await expect(page.getByLabel('Part title')).toHaveCount(2);
  await page.getByLabel('Part title').last().fill('Architecture frontend 2026');
  await page.getByLabel('Part intention').first().selectOption('Comparer');
  await page.getByRole('button', { name: '+ Add a sequence' }).last().click();
  await expect(page.getByLabel('Sequence title')).toHaveCount(3);
  await page.getByRole('button', { name: 'Delete sequence' }).last().click();
  await expect(page.getByLabel('Sequence title')).toHaveCount(2);
  const sectionTitles = page.getByLabel('Part title');
  const firstSectionTitle = await sectionTitles.nth(0).inputValue();
  const secondSectionTitle = await sectionTitles.nth(1).inputValue();
  await page.getByRole('button', { name: 'Collapse part' }).first().click();
  await expect(page.locator('.editor-section-card__body[data-collapsed="true"]')).toHaveCount(1);
  await expect(page.locator('.editor-section-card__body[data-collapsed="true"] input[aria-label="Sequence title"]')).toBeHidden();
  await expect(page.getByRole('button', { name: '+ Add a sequence' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Expand part' }).first().click();
  await expect(page.locator('.editor-section-card__body[data-collapsed="true"]')).toHaveCount(0);
  await expect(page.getByLabel('Sequence title')).toHaveCount(2);
  const reorderAutosaveResponse = page.waitForResponse(
    (response) => response.url().includes('/api/presentations/') && response.request().method() === 'PUT' && response.ok(),
  );
  await page.getByRole('button', { name: 'Move part down' }).first().click();
  await reorderAutosaveResponse;
  await expect(sectionTitles.nth(0)).toHaveValue(secondSectionTitle);
  await expect(sectionTitles.nth(1)).toHaveValue(firstSectionTitle);
  const notes = 'Remember to tell the concrete story before the transition.';
  await page.getByLabel('Private speaker notes: examples, transitions, reminders…').first().fill(notes);
  const multilineMessage = 'First line\nSecond line';
  await page.getByLabel('Visible message').first().fill(multilineMessage);
  await page.getByLabel('Code').first().fill('const answer = 42;');
  await page.getByLabel('Code language').first().selectOption('javascript');
  await page.locator('input[type="file"]').nth(1).setInputFiles(image);
  await page.getByLabel('Image description', { exact: true }).first().fill('Architecture diagram');
  await page.getByLabel('Transition', { exact: true }).first().selectOption('Zoom');
  const autosaveResponse = page.waitForResponse(
    (response) => response.url().includes('/api/presentations/') && response.request().method() === 'PUT' && response.ok(),
  );
  await page.getByLabel('Private speaker notes: examples, transitions, reminders…').first().fill(`${notes} Autosave check.`);
  await autosaveResponse;
  await expect(page.getByText('All changes saved')).toBeVisible();
  await expect(page.getByLabel('Part title')).toHaveCount(2);
  await expect(page.getByLabel('Sequence title')).toHaveCount(2);

  await page.reload();
  await expect(page.getByLabel('Part title')).toHaveCount(2);
  await expect(page.getByLabel('Part title').nth(0)).toHaveValue(secondSectionTitle);
  await expect(page.getByLabel('Part title').nth(1)).toHaveValue(firstSectionTitle);
  await expect(page.getByLabel('Sequence title')).toHaveCount(2);
  await expect(page.locator('.editor-cover-image-preview')).toBeVisible();
  await expect(page.getByLabel('Private speaker notes: examples, transitions, reminders…').first()).toHaveValue(`${notes} Autosave check.`);
  await expect(page.getByLabel('Visible message').first()).toHaveValue(multilineMessage);
  await expect(page.getByLabel('Part intention').nth(1)).toHaveValue('Comparer');
  await expect(page.getByLabel('Code').first()).toHaveValue('const answer = 42;');
  await expect(page.getByLabel('Code language').first()).toHaveValue('javascript');
  await expect(page.locator('.editor-sequence-image').first()).toBeVisible();
  await expect(page.getByLabel('Transition', { exact: true }).first()).toHaveValue('Zoom');
  const layout = page.getByLabel('Presentation format');
  await expect(layout).toHaveValue('desktop');
  const verticalLayoutResponse = page.waitForResponse(
    (response) => response.url().includes('/api/presentations/') && response.request().method() === 'PUT' && response.ok(),
  );
  await layout.selectOption('vertical');
  await verticalLayoutResponse;
  await page.reload();
  await expect(page.getByLabel('Presentation format')).toHaveValue('vertical');
  const presentationId = page.url().split('/').pop();
  await page.goto(`/present/${presentationId}`);
  await expect(page.locator('.presentation-shell')).toHaveAttribute('data-layout', 'vertical');
  const verticalOverview = await page.locator('.presentation-overview').boundingBox();
  expect(verticalOverview).not.toBeNull();
  expect(verticalOverview?.height).toBeGreaterThan(verticalOverview?.width ?? 0);
  await page.goto(`/presenter/${presentationId}`);
  await expect(page.getByRole('button', { name: 'Speaker notes' })).toBeVisible();
  await page.getByRole('button', { name: /Open part/ }).first().click();
  await page.getByRole('button', { name: 'Speaker notes' }).click();
  const notesPanel = page.locator('.presentation-notes');
  await expect(notesPanel).toHaveCSS('position', 'fixed');
  const initialNotesPosition = await notesPanel.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { left: styles.left, top: styles.top };
  });
  const dragHandle = page.getByRole('button', { name: 'Move speaker notes' });
  const dragHandleBox = await dragHandle.boundingBox();
  expect(dragHandleBox).not.toBeNull();
  await page.mouse.move((dragHandleBox?.x ?? 0) + 8, (dragHandleBox?.y ?? 0) + 8);
  await page.mouse.down();
  await page.mouse.move(120, 120);
  await page.mouse.up();
  const movedNotesPosition = await notesPanel.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { left: styles.left, top: styles.top };
  });
  expect(movedNotesPosition).not.toEqual(initialNotesPosition);
  await page.goto(`/editor/${presentationId}`);
  const presentAutosaveResponse = page.waitForResponse(
    (response) => response.url().includes('/api/presentations/') && response.request().method() === 'PUT' && response.ok(),
  );
  await page.getByLabel('Presentation title').fill(`${title} via Present`);
  await page.getByRole('link', { name: 'Present', exact: true }).click();
  await presentAutosaveResponse;
  await expect(page).toHaveURL(/\/present\//);
  await expect(page.getByRole('heading', { name: `${title} via Present` })).toBeVisible();
  await page.getByRole('button', { name: /Open part/ }).first().click();
  await expect(page.getByText('1 / 2')).toBeVisible();
  await expect(page.locator('.presentation-stage__message')).toHaveText(multilineMessage);
  await expect(page.locator('.presentation-stage__message')).toHaveCSS('white-space', 'pre-wrap');
});

test('opens the dedicated presentation stage and advances slides', async ({ page }) => {
  await page.goto('/present/presentation-demo');

  await expect(page.getByRole('heading', { name: 'Les architectures distribuées' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open part/ })).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Presenter view' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Speaker notes' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Presenter view' }).click();
  await expect(page).toHaveURL(/\/presenter\//);
  await expect(page.getByRole('button', { name: 'Speaker notes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Les architectures distribuées' })).toBeVisible();
  await page.getByRole('button', { name: /Open part/ }).first().click();
  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous' })).toBeVisible();
  await expect(page.getByText('1 / 2')).toBeVisible();
  const progressFill = page.locator('.presentation-progress__fill');
  const firstProgressWidth = await progressFill.evaluate((element) => element.getBoundingClientRect().width);
  const slide = page.locator('.presentation-stage__slide');
  await expect(slide).toHaveAttribute('data-transition', 'Fondu');
  const firstSlideTransform = await slide.evaluate((element) => getComputedStyle(element).transform);

    await page.keyboard.press('ArrowRight');
  await expect(page.getByText('2 / 2')).toBeVisible();
  await expect(slide).toHaveAttribute('data-transition', 'Glissement');
  await expect(page.locator('.presentation-code')).toBeVisible();
  await expect.poll(() => slide.evaluate((element) => getComputedStyle(element).transform)).not.toBe(firstSlideTransform);
  await expect.poll(() => progressFill.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(firstProgressWidth);
  const lastProgressWidth = await progressFill.evaluate((element) => element.getBoundingClientRect().width);
  expect(lastProgressWidth).toBeGreaterThan(firstProgressWidth);
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByText('1 / 2')).toBeVisible();

  await page.getByRole('button', { name: 'Speaker notes' }).click();
  await expect(page.getByText('Commencer par une situation vécue par le public.')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('2 / 2')).toBeVisible();
});

test('lets the presenter move speaker notes on the desktop stage', async ({ page }) => {
  await page.goto('/presenter/presentation-demo');
  await page.getByRole('button', { name: /Open part/ }).first().click();
  await page.getByRole('button', { name: 'Speaker notes' }).click();

  const notesPanel = page.locator('.presentation-notes');
  await expect(notesPanel).toHaveCSS('position', 'fixed');
  const initialNotesPosition = await notesPanel.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { left: styles.left, top: styles.top };
  });
  const dragHandle = page.getByRole('button', { name: 'Move speaker notes' });
  const dragHandleBox = await dragHandle.boundingBox();
  expect(dragHandleBox).not.toBeNull();
  await page.mouse.move((dragHandleBox?.x ?? 0) + 8, (dragHandleBox?.y ?? 0) + 8);
  await page.mouse.down();
  await page.mouse.move(120, 120);
  await page.mouse.up();

  const movedNotesPosition = await notesPanel.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { left: styles.left, top: styles.top };
  });
  expect(movedNotesPosition).not.toEqual(initialNotesPosition);
});

test('lets the presenter move the overview and topbar across the viewport', async ({ page }) => {
  await page.goto('/presenter/presentation-demo');

  const overview = page.locator('.presentation-overview');
  const overviewBox = await overview.boundingBox();
  expect(overviewBox).not.toBeNull();
  await page.mouse.move((overviewBox?.x ?? 0) + 24, (overviewBox?.y ?? 0) + 24);
  await page.mouse.down();
  await page.mouse.move(140, 180);
  await page.mouse.up();
  await expect(overview).toHaveCSS('position', 'fixed');

  const topbar = page.locator('.presentation-topbar');
  const brand = page.locator('.presentation-brand');
  const brandBox = await brand.boundingBox();
  expect(brandBox).not.toBeNull();
  await page.mouse.move((brandBox?.x ?? 0) + 10, (brandBox?.y ?? 0) + (brandBox?.height ?? 0) / 2);
  await page.mouse.down();
  await page.mouse.move(160, 90);
  await page.mouse.up();
  await expect(topbar).toHaveCSS('position', 'fixed');
});

test('opens a speaker note link inside the presentation and returns to the same slide', async ({ page }) => {
  await page.route('https://example.com/presentation-reference', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Embedded reference</title><main>Embedded reference content</main>',
    });
  });
  await page.route('**/api/presentations/presentation-demo', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const document = await response.json();
    document.sections[0].sequences[0].notes = 'Voir https://example.com/presentation-reference pour le détail.';
    await route.fulfill({ response, json: document });
  });

  await page.goto('/presenter/presentation-demo');
  await page.getByRole('button', { name: /Open part/ }).first().click();
  await page.getByRole('button', { name: 'Speaker notes' }).click();
  await page.getByRole('link', { name: 'https://example.com/presentation-reference' }).click();

  await expect(page.locator('.presentation-link-viewer')).toBeVisible();
  await expect(page.locator('.presentation-link-viewer__url')).toHaveText('https://example.com/presentation-reference');
  await expect(page.frameLocator('iframe[title="Embedded presentation link"]').getByText('Embedded reference content')).toBeVisible();
  await page.getByRole('button', { name: 'Back to presentation' }).click();
  await expect(page.locator('.presentation-link-viewer')).toHaveCount(0);
  await expect(page.getByText('1 / 2')).toBeVisible();
});
