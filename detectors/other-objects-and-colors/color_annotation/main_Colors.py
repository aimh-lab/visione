import argparse
from util.utilFiles import *
from color_annotation.colorAnnotation_thread import *
from util.utils_MongoDB import *

DEFAULT_FOLDER = {
    'V3C1': "Z:/VBS/V3C_dataset/V3C1",
    'V3C2': "Z:/VBS/V3C_dataset/V3C2",
    'MarineVideoKit': "F:/Datasets/MarineVideoKit",
}

IMAGE_FOLDERNAME = {
    'V3C1': 'keyframes_VISIONE',
    'V3C2': 'V3C2/keyframes_VISIONE',
    'MarineVideoKit': 'selected_frames'
}


def main(args):
    args_dic = vars(args)

    datadir = args_dic.get('datadir', DEFAULT_FOLDER[args.dataset])
    image_folder = f"{datadir}/{IMAGE_FOLDERNAME[args.dataset]}"

    out_Folder = f"{args_dic.get('output_folder', datadir)}"  # /color_annotation
    os.makedirs(out_Folder, exist_ok=True)

    listFN = f"{out_Folder}/{args.dataset}_listFn.txt"

    if os.path.isfile(listFN):
        with open(listFN, 'r') as f:
            filenames = [line.strip() for line in f]
        count = len(filenames)
        print(f"read {count} files")
    else:
        count, filenames = get_filenames(image_folder, 0, [])
        with open(listFN, 'w') as f:
            for item in filenames:
                f.write(f"{item}\n")

    if args.doAnnotation:
        ######################################################################################################
        # already_processed=open(out_Folder + 'processed.txt', 'r')
        # togliere le immagini già processate e  proseguire con una nuova
        # salvare su un altro file attenta che devi modificare il file

        # inizializing color annotation class
        ca = ColorAnnotation(args.ncols, args.nrows, (args.th_dominant, args.th_associated, args.th_quotient_da))
        ca.out_Folder = f'{out_Folder}/color_annotation/'
        os.makedirs(ca.out_Folder, exist_ok=True)
        #################################################################################################
        print("Using")
        print(f"\t Image Folder: {image_folder}")
        ca.print_info()
        ca.annotate(filenames)

    out_Folder = f'{out_Folder}/color_annotation'

    if args.saveMongoDB:
        collection_name = 'colorAnnotation_UNION'
        annotation_FN = f'{out_Folder}/{collection_name}.txt'
        save_in_mongo(annotation_FN, (args.dataset).lower(), collection_name,'colors',args.mongo_configfile)


# main_Colors.py --doAnnotation

# Press the green button in the gutter to run the script.
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Extract Color Annotation', argument_default=argparse.SUPPRESS,
                                     formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument('--doAnnotation', action='store_true', help='To annotate')
    parser.set_defaults(doAnnotation=False)  #
    parser.add_argument('--saveMongoDB', action='store_true', help='To save teh annotations in MongoDB')
    parser.set_defaults(saveMongoDB=False)  #
    parser.add_argument('--mongo_configfile', default='../visione_MongoDBConfig.yaml', help='yaml with host username e passoerd of MongoDB')


    parser.add_argument('-d', '--dataset', choices=['V3C1', 'V3C2', 'MarineVideoKit'], default='MarineVideoKit',
                        help='Name of the dataset.')  #
    parser.add_argument('--datadir', type=str,
                        help='Path of the dir containing the dataset (main folder). If not setted the default V3C1,V3C2, and MarineVideoKit will be used')

    parser.add_argument('-ncols', type=int, default=7, help='number of cell columns')
    parser.add_argument('-nrows', type=int, default=7, help='number of cell rows')
    parser.add_argument('-th_dominant', type=float, default=0.3, help='th_dominant')
    parser.add_argument('-th_associated', type=float, default=0.15, help='th_associated')
    parser.add_argument('-th_quotient_da', type=float, default=0.15, help='th_quotient_da')
    parser.add_argument('--output_folder',
                        help='output folder. If not set, a color_annotation folder will be created in the datadir')  # f'H:/Datasets/V3C-VBS/'

    args = parser.parse_args()
    print(args)
    main(args)


