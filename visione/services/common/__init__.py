import yaml


def load_config(yaml_path):
    # load config file
    with open(yaml_path, 'r') as yaml_file:
        config = yaml.safe_load(yaml_file)

    # fill default URL values
    def _fill_null(dictionary, fill_value):
        for k, v in dictionary.items():
            if v is None:
                dictionary[k] = fill_value

    _fill_null(config['static_files_urls'], 'http://router')
    _fill_null(config['services_urls'], 'http://router')

    return config


class CliProgress(object):
    """ Progress bar for CLI. """
    def __init__(self, initial=0, total=-1, print_fn=print):
        super(CliProgress, self).__init__()
        self.initial = initial
        self.total = -1 if total is None else total
        self.print_fn = print_fn

    def __call__(self, iterable):

        def _wrapped(iterable):
            self.print()
            for it in iterable:
                yield it
                self.initial += 1
                self.print()

            if self.total < 0:
                self.total = self.initial
            self.print()

        return _wrapped(iterable)

    def print(self):
        self.print_fn(f'progress: {self.initial}/{self.total}', flush=True)


def cli_progress(iterable, initial=0, total=-1, print_fn=print):
    return CliProgress(initial, total, print_fn)(iterable)