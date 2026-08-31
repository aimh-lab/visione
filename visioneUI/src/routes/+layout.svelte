<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:boundary onerror={(error) => console.error('[svelte:boundary] fatal config error', error)}>
	{@render children()}

	{#snippet failed(error, reset)}
		<div style="max-width: 720px; margin: 10vh auto; padding: 0 1.5rem; font-family: system-ui, sans-serif; color: #e2e8f0;">
			<h1 style="font-size: 1.25rem; margin-bottom: 0.5rem;">⚠️ Something needed configuration that isn't there yet</h1>
			<p style="color: #94a3b8; margin-bottom: 1rem;">
				This is usually a missing/incomplete file in <code>src/config/runtimeProfiles/collections/</code> for the
				active dataset collection, or an unrecognized value in a dataset-dependent setting. The app
				deliberately fails loudly here instead of silently guessing, so the message below should point at
				the exact fix.
			</p>
			<pre style="white-space: pre-wrap; background: #1e293b; padding: 1rem; border-radius: 8px; font-size: 0.85rem; color: #fca5a5;">{error instanceof Error ? error.message : String(error)}</pre>
			<button
				type="button"
				onclick={reset}
				style="margin-top: 1rem; padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: #e2e8f0; cursor: pointer;"
			>
				Retry (after fixing the config)
			</button>
		</div>
	{/snippet}
</svelte:boundary>
